const session = require("express-session")
const bcrypt = require("bcrypt")
const express = require("express");
const path = require("path")
//set up require the database to store and retieve users, passwords
const redis = require("redis");
const app = express();
const client = redis.createClient();
const RedisStore = require("connect-redis")(session)
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

app.set("view engine", "pug")
app.set("views", path.join(__dirname, "views"))
//Tell the program to watch the root folder for an index page and listen to port 3005
app.get("/", (req, res) => {
  if (req.session.userid) {
    res.render("dashboard")
  } else {
    res.render("login")
  }
});

//Now create a post endpoint
app.post('/', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    res.render('error', {
      message: "Please create a username AND a password."
    })
    return
  }
  const saveSessionAndRenderDashboard = (userid) => {
    req.session.userid = userid
    req.session.save()
    res.render('dashboard')
  }
  console.log(req.body, username, password);

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
    }
      //here comes the login
      const handleLogin = (userid, password) => {
      client.hget(`user:${userid}`, 'hash', async (err, hash) => {
        const result = await bcrypt.compare(password, hash); //returns true or false
        if (result) {
          saveSessionAndRenderDashboard(userid)
          //then the PS is matching
        } else {
          res.render("error", {
            message: "Password is incorrect",
          })
          return
        }
      })
      }
  client.hget('users', username, (err, userid) => {
    if (!userid) {
      handleSignup(username, password)
    } else {
      handleLogin(userid, password)
    }
  })
  })
  app.listen(3005, () => console.log("Server is ready Sir!"));
