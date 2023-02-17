//to be able to use env file for secrets we need dotenv here.
require("dotenv").config();

const express = require("express");
require('./passport');
const app = express();

const bodyParser = require('body-parser');

const pg = require('pg');

const fetch = require('node-fetch');

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

const uid = require('uuid');

// app.use(express.static(path.join(__dirname, 'public')));

const JWT = require('jsonwebtoken');
//telling our server that we want to be able to access forms in html pages inside our request.
//express.urlencoded() is a method inbuilt in express to recognize the incoming Request Object as strings or arrays.
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

const port = 3100;
const db = require('./database.js');
// const pgp = require('pg-promise')(/* options */)
// const db = pgp('postgres://postgres:pulga@localhost:5432/onehabit')
const accountSid = process.env.ACCOUNT_SID;
  const authToken= process.env.AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);

const signToken = (userID) => {
  return JWT.sign({
    iss: process.env.SECRET_KEY,
    sub: userID
    //removing expiresIn: '24h' from {} so the token does not expire.
  }, process.env.SECRET_KEY, {})
};

let authenticated = false;



app.get("/", function(req, res) {

  console.log('/ authenticated:', authenticated);
  if (authenticated) {
    res.render('index', {
      message: true,
      tags: 'authenticated'
    })
  } else {
    res.render('index', {
      message: false,
      tags: 'Unauthenticated'
    })
  }
});

app.get('/register-page', function(req, res) {

  if (authenticated) {
    res.render('register', {
      message: true,
      tags: 'authenticated',
      taken:''
    })
  } else {
    res.render('register', {
      message: false,
      tags: 'Unauthenticated',
      taken:''
    })
  }
});

app.get('/login-page', function(req, res) {

  if (authenticated) {
    res.render('login', {
      message: true,
      tags: 'authenticated',
      check:''
    })
  } else {
    res.render('login', {
      message: false,
      tags: 'Unauthenticated',
      check:''
    })
  }
})

app.post("/register", (req, res) => {
  let {userNameReg, passwordReg} = req.body;

//this checks our POSTGRESQL if the username exits.If not it will be caught in .catch
  db.none('SELECT username FROM users WHERE username = $1', userNameReg).then((data) => {

    ///bcrypt
    bcrypt.hash(passwordReg, 10)
    .then(function(hash) {
      passwordReg = hash;
      ///INSERTING TO POSTGRESQL AFTER HASHING
      //crud - create
      db.none('INSERT INTO users VALUES($1,$2,$3,$4,$5)', [uid.v4(), passwordReg, '', '', userNameReg]).then((x) => {

        res.status(200).redirect('/');
      }).catch(err => {
        console.log('something went wront with inserting user values');
      });

      //ENDING INSERTING TO POSTGRESQL AFTER HASHING
    }).catch((err) => {
      console.log('err:', err);
    });
    ///END bcrypt
  }).catch((err) => {
    //let send back data to register.ejs

    res.render('register', {
      message: false,
      tags: 'unauthenticated',
      taken:'username taken'
    })

  })// END DATABASE CHECK FOR USERNAME

});//END REGISTER ROUTE


// I NEED TO BE ABLE TO CHECK PASSWORD AND HASH/SALT FROM DATABASE
// SEE IF I CAN RETRIEVE USER PASSWORD HERE.
app.post("/login",passport.authenticate('local', {
  failureRedirect: '/login-page',
  session: false
}), (req, res) => {

  console.log('/login authenticated?', req.isAuthenticated());
  const {password, user_uid} = req.user[0];

  if (req.isAuthenticated()) {

    console.log('phone from /login:',req.user[0].phone);

    authenticated = true;
    let token = signToken(user_uid);
    res.cookie('access_token', token, {
      httpOnly: true,
      sameSite: true
    });
    res.redirect('/settings');
  }
  // else{

    // res.render('login', {
    //   message: false,
    //   tags: '',
    //   check:'Re-enter username and password!'
    // });
  // }

});

app.get('/settings',passport.authenticate('jwt', {session: false}), (req, res) => {
  console.log('phone from /settings:',req.user[0].phone);
  res.render('settings', {
    message: true,
    tags: 'authenticated'
  });
});


app.post('/settings-submit', passport.authenticate('jwt', {session: false}),(req, res) => {
  const {areaCode, phone, location} = req.body;
  let phoneUS= `+1${phone}`;
  console.log('--------------->:',location);
  fetch(`https://api.openweathermap.org/data/2.5/weather?zip=${areaCode}&appid=e0da5a6ab2277de52533c75912e29264`).then((res) => {
    return res.json();
  }).then((data) => {
    let dataObj={
      areaCode:areaCode,
      phone:phoneUS,
      location:location,
      retrievedSeconds: data.dt,
      timeZone: data.timezone,
      cityName:data.name,
      sunriseSec:data.sys.sunrise,
      localSunriseTime: function(){return new Date(this.sunriseSec*1000).toLocaleTimeString('en-US',{timeZone:`${this.location}`})},
      minus30Minutes: function(){return new Date((this.sunriseSec-1800)*1000).toLocaleTimeString('en-US',{timeZone:`${this.location}`})}
    };
    console.log('localSunriseTime fro settings-sub:',dataObj.localSunriseTime());
    console.log('minus30 from settings-submit:',dataObj.minus30Minutes());
//     let retrievedSeconds=data.dt;
//     let timeZone=data.timezone;
//     let cityName = data.name;
//     let sunriseSec = data.sys.sunrise;
//     let d= new Date(sunriseSec*1000);
//     let localSunriseTime= d.toLocaleTimeString('en-US',{timeZone:`${location}`});
// console.log('from settings-submit:',localSunriseTime);
//
// let s=new Date((sunriseSec-1800)*1000);
// let minus30Minutes = s.toLocaleTimeString('en-US',{timeZone:`${location}`});
//
// console.log('from settings-submit:',minus30Minutes);
//crud - update
    db.any('Update users SET areaCode = $1, phone = $2,city=$4,time=$5 WHERE user_uid= $3', [
      areaCode, phoneUS, req.user[0].user_uid,dataObj.cityName,dataObj.localSunriseTime()
    ]).then((d) => {
      timeInterval(dataObj);
      res.redirect('/profile');

    }).catch((err) => {
      console.log(err);
    });
    /// END DB QUERY

  }).catch((err) => console.log(err));

})

app.get("/logout", passport.authenticate('jwt', {session: false}), (req, res) => {
  res.clearCookie('access_token');
  authenticated = false;
  res.status(200).redirect('/');
});


app.get('/profile', passport.authenticate('jwt', {session: false}), (req, res) => {
  console.log('phone from /profile:',req.user[0].phone);

  if (req.user[0].phone != '' && req.user[0].areaCode != '') {
    res.render('profile', {
      name: req.user[0].username,
      phone: req.user[0].phone,
      areaCode: req.user[0].areacode,
      sunriseMessage: `The sun will rise at ${req.user[0].time} in ${req.user[0].city}`,
      message: true,
      tags: 'authenticated'
    });
  } else {
    res.render('profile', {
      name: req.user[0].username,
      phone: req.user[0].phone,
      areaCode: req.user[0].areacode,
      sunriseMessage: '<a href="/settings">Set up your phone number and area code</a>',
      message: true,
      tags: 'authenticated'
    });
  }

});


app.post('/clear-phone',passport.authenticate('jwt', {session: false}), (req, res)=>{
  // db.any("UPDATE users SET phone=$1 WHERE username=$2",['',req.user[0].username])
  // .then((data)=>{
  //   console.log('CLEARED NUMBER --> CHECK POSTGRESQL');
  //   res.redirect('/profile');
  // })
  // .catch((err)=>{
  //   console.log(err);
  // })
clearInterval(timerInterval);
console.log('CLEARINTERVAL SHOULD HAVE CLEARED');
res.redirect('/profile');
});

app.use(passport.initialize());

//use zip code for api to get dt. get time of 30 min before'
let catcher;
function time(dataObj){ //runs every second.
//get current time and compare with
let nodeTime= new Date().toLocaleTimeString('en-US',{timeZone:dataObj.location});
// console.log(`${dataObj.phone}: `,nodeTime);
// console.log('minus30:',dataObj.minus30Minutes());
// let timeTester='11:34:30 AM';
// console.log('minus30:',dataObj.minus30Minutes());
  if(nodeTime == dataObj.minus30Minutes()){
    console.log(`api was called again at ${dataObj.minus30Minutes()}`);
    //make api call and set new values to sunriseRegular
    fetch(`https://api.openweathermap.org/data/2.5/weather?zip=${dataObj.areaCode}&appid=e0da5a6ab2277de52533c75912e29264`).then((res) => {
      return res.json();
    }).then((data) => {

      let dt3 = data.sys.sunrise;
      let date3 = new Date(dt3 * 1000);
      // catcher = date3.toLocaleTimeString('en-US',{timeZone:dataObj.location});
      catcher=date3.toLocaleTimeString('en-US',{timeZone:dataObj.location});
  // console.log('catcher:',catcher);
    })
    .catch(err=>console.log(err));
  };
// console.log('catcher here:',catcher);
  if(nodeTime==catcher){
    console.log('-------------->> true that nodeTime && catcher are the same');
    client.messages
      .create({
         body: 'Testing from rickys project app. The sun is out! go get some light',
         from: '+15626008651',
         to: dataObj.phone
       })
      .then(message =>{
         console.log(`message sent to ${dataObj.phone}. its ${catcher}!!`);
       })
       .catch((err)=>console.log('reason we fail sending:',err));
  };

};

let timerInterval;
function timeInterval(dataObj){
    timerInterval= setInterval(function(){time(dataObj)},1000);
};

app.listen(port, (res, req) => {
  console.log(`app.js is running on port ${port}`);
});
