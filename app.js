const bcrypt = require("bcrypt")
const express = require("express");
const path = require("path")
//set up the database to store and retieve users, passwords
const redis = require("redis");
const app = express();
const client = redis.createClient();
//Now add some middleware to process the url encoded data
app.use(express.urlencoded({ extended: true }));
//Now create a post endpoint
app.set("view engine", "pug")
app.set("views", path.join(__dirname, "views"))
//Tell the program to watch the root folder for an index page and listen to port 3005
app.get("/", (req, res) => res.render("index"));


app.post('/', (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    res.render('error', {
      message: "Please create a username AND a password"
    })
    return
  }
  console.log(req.body, username, password);
 //HGET is a redis command  that returns the value of a field in a hash
  client.hget('users', username, (err, userid) => {
    if (!userid) {
      //user doesn't exist, so a signup process begins
      client.incr("userid", async (err, userid) => {
        client.hset("users", username, userid);
        const saltRounds = 10;
        const hash = await bcrypt.hash(password, saltRounds);
        client.hset(`user:${userid}`, "hash", hash, "username", username);
      });
    } else {
      client.hget(`user:${userid}`, 'hash', async (err, hash) => {
        const result = await bcrypt.compare(password, hash); //returns true or false
        if (result) {
          //then the PS is matching
        } else {
          //the password is incorrect
        }
      })
    }
  })
  res.end()
  app.listen(3005, () => console.log("Server is ready Sir!"))
});
