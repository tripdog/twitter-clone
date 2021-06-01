const express = require("express");
const path = require("path");
//set up require the database to store and retieve users, passwords
const redis = require("redis");
const session = require("express-session");
const bcrypt = require("bcrypt");
const { formatDistance } = require("date-fns");

const client = redis.createClient();
const { promisify } = require("util");

const app = express();
const RedisStore = require("connect-redis")(session);
//Now add some middleware to process the url encoded data
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new RedisStore({ client: client }),
    resave: true,
    cookie: {
      maxAge: 3600000, //10 hours
      httpOnly: false,
      secure: false,
      sameSite: "lax",
    },
    secret: "AsecretPWtoValidateAsession0k?",
    saveUninitialized: true,
  })
);

app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

const ahget = promisify(client.hget).bind(client);
const asmembers = promisify(client.smembers).bind(client);
const ahkeys = promisify(client.hkeys).bind(client);
const aincr = promisify(client.incr).bind(client);
const alrange = promisify(client.lrange).bind(client);

//Tell the program to watch the root folder for an index page and listen to port 3005
app.get("/", async (req, res) => {
  if (req.session.userid) {
    const currentUserName = await ahget(
      `user:${req.session.userid}`,
      "username"
    );
    const following = await asmembers(`following:${currentUserName}`);
    const users = await ahkeys("users");

    const timeline = [];
    const posts = await alrange(`timeline:${currentUserName}`, 0, 100);

    for (post of posts) {
      const timestamp = await ahget(`post:${post}`, "timestamp");
      const timeString = formatDistance(
        new Date(),
        new Date(parseInt(timestamp))
      );

      timeline.push({
        message: await ahget(`post:${post}`, "message"),
        author: await ahget(`post:${post}`, "username"),
        timeString: timeString,
      });
    }

    res.render("dashboard", {
      users: users.filter(
        (user) => user !== currentUserName && following.indexOf(user) === -1
      ),
      currentUserName,
      timeline,
    });
  } else {
    res.render("login");
  }
});

app.get("/post", (req, res) => {
  if (req.session.userid) {
    res.render("post");
  } else {
    res.render("login");
  }
});

app.post("/post", async (req, res) => {
  if (!req.session.userid) {
    res.render("login");
    return;
  }

  const { message } = req.body;
  const currentUserName = await ahget(`user:${req.session.userid}`, "username");
  const postid = await aincr("postid");
  client.hmset(
    `post:${postid}`,
    "userid",
    req.session.userid,
    "username",
    currentUserName,
    "message",
    message,
    "timestamp",
    Date.now()
  );
  client.lpush(`timeline:${currentUserName}`, postid);

  const followers = await asmembers(`followers:${currentUserName}`);
  for (follower of followers) {
    client.lpush(`timeline:${follower}`, postid);
  }

  res.redirect("/");
});

app.post("/follow", (req, res) => {
  if (!req.session.userid) {
    res.render("login");
    return;
  }
  const { username } = req.body;
  client.hget(
    `user:${req.session.userid}`,
    "username",
    (err, currentUserName) => {
      client.sadd(`following:${currentUserName}`, username);
      client.sadd(`followers:${username}`, currentUserName);
    }
  );
  res.redirect("/");
});

app.post("/", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.render("error", {
      message: "Please create a username AND a password.",
    });
    return;
  }
  const saveSessionAndRenderDashboard = (userid) => {
    req.session.userid = userid;
    req.session.save();
    client.hkeys("users", (err, users) => {
      res.render("dashboard", {
        users,
      });
    });
  };

  // console.log(req.body, username, password);

  //HGET is a redis command  that returns the value of a field in a hash
  const handleSignup = (username, password) => {
    //user doesn't exist, so a signup process begins
    client.incr("userid", async (err, userid) => {
      client.hset("users", username, userid);

      const saltRounds = 10;
      const hash = await bcrypt.hash(password, saltRounds);

      client.hset(`user:${userid}`, "hash", hash, "username", username);

      saveSessionAndRenderDashboard(userid);
    });
  };
  //here comes the login
  const handleLogin = (userid, password) => {
    client.hget(`user:${userid}`, "hash", async (err, hash) => {
      const result = await bcrypt.compare(password, hash); //returns true or false
      if (result) {
        saveSessionAndRenderDashboard(userid);
        //then the PS is matching
      } else {
        res.render("error", {
          message: "Password is incorrect",
        });
        return;
      }
    });
  };
  client.hget("users", username, (err, userid) => {
    if (!userid) {
      handleSignup(username, password);
    } else {
      handleLogin(userid, password);
    }
  });
});
app.listen(3005, () => console.log("Server is ready Sir!"));
