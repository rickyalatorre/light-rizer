//to be able to use env file for secrets we need dotenv here.
require("dotenv").config();
const express= require("express");

const app= express();

const bodyParser = require('body-parser');

const pg= require('pg');

const passport = require('passport');

const passportConfig = require('./passport.js');

var cookieParser = require('cookie-parser');

const cookieSession = require('cookie-session');

const bcrypt = require('bcrypt');

const path = require('path');
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(cookieParser());
app.use(express.json());

const uid=require('uuid');

// app.use(express.static(path.join(__dirname, 'public')));
console.log('uid:',uid.v4());

const JWT=require('jsonwebtoken');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

require('./passport');

const port= 3100;

const pgp = require('pg-promise')(/* options */)
const db = pgp('postgres://postgres:pulga@localhost:5432/onehabit')


const signToken= (userID)=>{
  return JWT.sign({
    iss: process.env.SECRET_KEY,
    sub: userID
  },process.env.SECRET_KEY, { expiresIn: '24h' })
};

// app.get("/",(req,res)=>{
// //homepage where we can register or login
// });
app.get("/", function (req, res) {
res.render('index')
});



app.post("/register",(req,res)=>{
  let {userNameReg,passwordReg}=req.body;

  // db.none('INSERT INTO users VALUES($1,$2,$3,$4,$5)',[uid.v4(),passwordReg,'','',userNameReg])
  // .then((data)=>{
  //   res.status(200).redirect('/');
  //   console.log('data:',data);
  // })
  // .catch((err)=>{
  //   console.log('err:',err);
  // });

  //CREATE STEPS TO CREATE NEW USER
  //we need to check if that user already exists.
  //if the user already exists send a message it already exists.
  //If the user doesnt exist then create a new user

//*******WE NEED A CHECK TO SEE IF USERNAME IS ALREADY TAKEN!!!!
console.log('userNameReg:',userNameReg);

db.none('SELECT username FROM users WHERE username = $1', userNameReg)
.then((data)=>{
  console.log('no username found:create one');
  bcrypt.hash(passwordReg, 10)
  .then(function(hash){
    passwordReg=hash;
    db.none('INSERT INTO users VALUES($1,$2,$3,$4,$5)',[uid.v4(),passwordReg,'','',userNameReg])
    .then((data)=>{
      res.status(200).redirect('/');
      console.log('data:',data);
    })
    .catch((err)=>{
      console.log('err:',err);
    });
  })
  .catch((err)=>{
    console.log(err);
  })
})

.catch((err)=>{
  //SEND BACK JSON THAT USERNAME IS ALREADY TAKEN
  console.log('data is true : reject');
})

});

// I NEED TO BE ABLE TO CHECK PASSWORD AND HASH/SALT FROM DATABASE
// SEE IF I CAN RETRIEVE USER PASSWORD HERE.
app.post("/login",passport.authenticate('local',{failureRedirect:'/',failureMessage: true, session:false}),(req,res)=>{

  const {password,user_uid}=req.user[0];

  if(req.isAuthenticated()){

    console.log('user_uid:',user_uid);
    console.log('inside is authenticated');
    let token=signToken(user_uid);
    res.cookie('access_token',token,{httpOnly:true,sameSite:true});

      console.log('successfully logged in');
      res.redirect('/profile');
}

});

app.get("/logout",passport.authenticate('jwt',{session:false}),(req,res)=>{
res.clearCookie('access_token');
res.status(200).redirect('/');

});


app.get('/profile',passport.authenticate('jwt',{session:false}),(req,res)=>{
// so req.user[0] is always going to match the username and password we login with
//we dont have to loop through the array of req.user.

  res.render('profile',{
    name: req.user[0].username,
    phone:req.user[0].phone,
    habit:req.user[0].habit
  });

});


app.listen(port,(res,req)=>{
  console.log(`app.js is running on port ${port}`);
});
