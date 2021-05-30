const express = require("express");
const path = require("path")
const app = express();
//Now add some middleware to process the url encoded data
app.use(express.urlencoded({ extended: true }));
//Now create a post endpoint
app.set("view engine", "pug")
app.set("views", path.join(__dirname, "views"))
//Tell the program to watch the root folder for an index page and listen to port 3005
app.get("/", (req, res) => res.render("index"));
app.listen(3005, () => console.log("Server is ready Sir!"));

app.post("/", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.render("error", {
      message: "Please create username and password",
    });
    return;
  }
  console.log(req.body, username, password);
  res.end();
});
