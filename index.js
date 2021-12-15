const express = require('express');
const app = express();

const http = require('http').Server(app);
const path = require('path');
var session = require("express-session");
var MongoStore = require('connect-mongo');
const {
  login,
  registerUser,
  addRating,
  getMovie,
  getRecs,
  url
} = require('./utils/db');
const { generatePrimeSync } = require('crypto');

app.engine('html', require('ejs').renderFile);
app.set('views', __dirname + '/public');

const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded());

app.use(session({
  resave: false,
  saveUninitialized: true,
  secret: 'my secret string',
  store: new MongoStore({mongoUrl: url})
}))

app.post('/', async function(req, res){
  var {username, password, register } = req.body;
  var userId = null;
  if (register) {
    var userId = await registerUser(username,password);
  }
  else
  {
    var userId = await login(username, password);
  }
  req.session.userid = userId;

  res.redirect('/main')
});

app.post('/main', async function(req, res){
  console.log("hellohellohello")
  var {movieId, userid} = req.session;
  var out = req.body.value;
  await addRating(userid,movieId,out);
});

app.get("/main", async function(req, res) {
  var {userid} = req.session;
  var recs = await getRecs(userid);
  console.log(recs);
  var movie = await getMovie(userid);
  req.session.movieId = movie.id;
  res.render('main.ejs', { image_url: movie.poster, title: movie.title, year:movie.year, recs: recs})
});

app.post('/logout', async function(req, res) {
  req.session.userid = '';
  res.redirect('/');
});

http.listen(port, () => {
  console.log(`Server running at http://localhost:3000/`);
});
