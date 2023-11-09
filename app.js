//to be able to use env file for secrets we need dotenv here.
require("dotenv").config();

const express = require("express");
require('./passport');

const app = express();

const http = require('http');

// setInterval(() => {
//   http.get("https://light-rizer-be68c0f003b3.herokuapp.com");
// }, 25 * 60 * 1000); // every 25 minutes

const bodyParser = require('body-parser');

const pg = require('pg');

const fetch = require('node-fetch');

const passport = require('passport');

const passportConfig = require('./passport.js');

var cookieParser = require('cookie-parser');

const cookieSession = require('cookie-session');

const bcrypt = require('bcrypt');

const path = require('path');
app.set("view engine", "ejs");

app.use(cookieParser());

app.use(express.json());

const uid = require('uuid');

app.use(express.static("public"));

const JWT = require('jsonwebtoken');
//telling our server that we want to be able to access forms in html pages inside our request.
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

const PORT= process.env.PORT || 3100;

const db = require('./database.js');

const accountSid = process.env.ACCOUNT_SID;

const authToken= process.env.AUTH_TOKEN;

const client = require('twilio')(accountSid, authToken);

//when sigterm starts back up do a check if the user
// setInterval(()=>console.log('tick'),1000);

//jwt will be made with secret_key. Our server checks that secret_key is still
//inside jwt to make sure no one tampered with it.
const signToken = (userID) => {
  return JWT.sign({
    iss: process.env.SECRET_KEY,
    sub: userID
    //removing expiresIn: '24h' from {} so the token does not expire.
  }, process.env.SECRET_KEY, {})
};

app.get("/", function(req, res) {
  passport.authenticate('jwt', { session: false, failureRedirect: '/login-page' }, function(err, user, info) {
    console.log('err:',err);
    console.log('user:',user);
    if (user) {
      res.render('index', {
        message: true,
        username:user[0].username
      })
    } else {
      res.render('index', {
        message: false,
        username:''
      })
    }
})(req,res);
});

// Will return to /profile if manually typed in when authenticated.
app.get('/register-page', function(req, res) {
  passport.authenticate('jwt', { session: false }, function(err, user, info) {
    if (user) {
      res.redirect('/profile');
    } else {
      res.render('register', {
        message: false,
        taken:'',
        username:''
      });
    }
  })(req,res);
});

// Will return to /profile if manually typed in when authenticated.
app.get('/login-page', function(req, res) {

  passport.authenticate('jwt', { session: false }, function(err, user, info) {
    if (user) {
      res.redirect('/profile')
    }
    else {
      res.render('login', {
        message: false,
        username:'',
        messageFailure:''
      });
    }
  })(req,res);
});

//**************** come back and add logic to check if we are authenticated
app.post("/register", (req, res) => {
  let {userNameReg, passwordReg} = req.body;
// This checks our POSTGRESQL if the username exists.
// db.none Executes a query that expects no data to be returned. If the query returns any data, the method rejects.
// if data is true then we result to landing in else{}.
// if there is no data. We use passwordReg and hash it using bycrypt.
  db.none('SELECT username FROM users WHERE username = $1', userNameReg).then((data) => {
    ///bcrypt
    bcrypt.hash(passwordReg, 10)
    .then(function(hash) {
      passwordReg = hash;
      ///INSERTING TO POSTGRESQL AFTER HASHING sending us to /login
      //crud - create
      db.none('INSERT INTO users VALUES($1,$2,$3,$4,$5)', [uid.v4(), passwordReg, '', '', userNameReg]).then((x) => {
        res.status(200).redirect('/login-page');
      }).catch(err => {
        console.log('something went wrong with inserting user values');
      });
    }).catch((err) => {
      console.log('err:', err);
    });
    ///END bcrypt
  }).catch((err) => {
    //if username and password already exists we send back taken to /register-page
    res.render('register', {
      message: false,
      taken:'<h3 class="submission-error">Username taken. Please try again</h3>',
      username:''
    })
  })
});


//Retrieves req.user[0] and req.isAuthenticated from passport local when
//username and password are correct. Else will direct us back to login-page.
//**************** come back and add logic to check if we are authenticated
app.post('/login', function(req, res, next) {
  passport.authenticate('local', { session: false }, function(err, user, info) {
    if (err) {
      console.log('error---->',err)
      res.render('login', {
        message: false,
        username:'',
        messageFailure:err
      });
    }
    if (!user) {
      console.log('!user statement---->',info.message);
      res.render('login', {
        message: false,
        username:'',
        messageFailure:`<h3 class="submission-error">${info.message}</h3>`
      });
    }

if(user){
  const userPassword=user[0].password;
  const userUserUid=user[0].user_uid;

      userName=user[0].username;
      let token = signToken(userUserUid);
      res.cookie('access_token', token, {
        httpOnly: true,
        sameSite: true
      });
        res.redirect('/profile');
}
  })(req, res, next);
});


app.get('/settings',passport.authenticate('jwt', {
  failureRedirect: '/login-page',
  session: false
}), (req, res) => {
  res.render('settings', {
    message: true,
    username:req.user[0].username
  });
});


//If phone !=='' then have /profile route render activated
app.post('/settings-submit', passport.authenticate('jwt', {
  failureRedirect: '/login-page',
  session: false
}),(req, res) => {

  const {areaCode,phoneAreaCode,phoneMiddleNumbers, phoneLastNumbers, location} = req.body;
// Turn collect all 3 phone number inputs and combine them
  let phone=phoneAreaCode+phoneMiddleNumbers+phoneLastNumbers;
//day submitted
let today= new Date();
//in 2 in2Days
const twoDaysLater = new Date();
twoDaysLater.setDate(today.getDate() + 2);
let jsonString;
  let phoneUS= `+1${phone}`;
  fetch(`https://api.openweathermap.org/data/2.5/weather?zip=${areaCode}&appid=e0da5a6ab2277de52533c75912e29264`).then((res) => {
    return res.json();
  }).then((data) => {
function localTime(sec,location){
  console.log('localTime:', typeof sec);
  return new Date(sec*1000).toLocaleTimeString('en-US',{timeZone:`${location}`})
}
function minus30(sec,location){
  console.log('minus30:',typeof sec);
  return new Date((sec-1800)*1000).toLocaleTimeString('en-US',{timeZone:`${location}`})
}
    let dataObj={
      areaCode:areaCode,
      phone:phoneUS,
      location:location,
      retrievedSeconds: data.dt,
      timeZone: data.timezone,
      cityName:data.name,
      sunriseSec:data.sys.sunrise,
      localSunriseTime: localTime(data.sys.sunrise,location),
      minus30Minutes: minus30(data.sys.sunrise,location),
      in2Days: twoDaysLater.toDateString(),
      dayOfSubmit: today.toDateString(),
    };
    jsonString = JSON.stringify(dataObj);
console.log('jsonString->',jsonString);
// Updating zip code and phone number and or activating messages
    db.any('Update users SET areaCode = $1, phone = $2,city=$4,time=$5,activation=$6,obj=$7 WHERE user_uid= $3', [
      areaCode, phoneUS, req.user[0].user_uid,dataObj.cityName,dataObj.localSunriseTime,'Message Activated',jsonString
    ]).then((d) => {
      timeInterval(dataObj);
      res.redirect('/profile');

    }).catch((err) => {
      console.log(err);
    });
    /// END DB QUERY

  }).catch((err) => console.log(err));
});

app.get("/logout", passport.authenticate('jwt', {
  failureRedirect: '/login-page',
  session: false
}), (req, res) => {
  res.clearCookie('access_token');
  // authenticated = false; **** commented this out because we used passport jwt instead
  res.status(200).redirect('/');
});


app.get('/profile', passport.authenticate('jwt', {
  failureRedirect: '/login-page',
  session: false
}), (req, res) => {
// If phone number and zip code are not empty strings then profile will display time in your city.
// Else profile will have a message directing us to settings to set up phone number and zip code to activate messages
  if (req.user[0].phone != '' && req.user[0].areaCode != '') {
    res.render('profile', {
      messagesActivated:req.user[0].activation,
      name: req.user[0].username,
      phone: req.user[0].phone,
      areaCode: req.user[0].areacode,
      sunriseMessage: `<span>The sun will rise at <span class="unbreak">${req.user[0].time}</span> in <span class="unbreak">${req.user[0].city}</span></span>`,
      message: true,
      username:req.user[0].username
    });
  } else {
    res.render('profile', {
      messagesActivated:req.user[0].activation,
      name: req.user[0].username,
      phone: req.user[0].phone,
      areaCode: req.user[0].areacode,
      sunriseMessage: '<a href="/settings">Click here to set up your phone number and zip code</a>',
      message: true,
      username:req.user[0].username
    });
  }

});

//Unactivated to profile
app.post('/clear-phone',passport.authenticate('jwt', {
  failureRedirect: '/login-page',
  session: false
}), (req, res)=>{
  // phoneActivation='Messages Unactivated';
  db.any('Update users SET activation=$1 WHERE user_uid= $2', [
    'Message Unactivated',req.user[0].user_uid
  ]).then((d)=>{
    clearInterval(timerInterval);
    res.redirect('/profile');
  }).catch((err) => {
    console.log(err);
  });
});

app.use(passport.initialize());

let textbeltApi=process.env.TEXTBELT_API;

//*********************** timer *****************************
// Catcher will catch the new time 30 min before sunrise time
let catcher;
function time(dataObj){ //runs every second.

let nodeTime= new Date().toLocaleTimeString('en-US',{timeZone:dataObj.location});
// console.log('nodeTime: ',nodeTime);
// When current time equals to 30 min before sunrise call weather api again to get
// any new time the sun will rise
if(new Date().toDateString() == dataObj.in2Days){
  //clear timerInterval
  console.log(`Day submitted was ${dataObj.dayOfSubmit}. We clear the interval timer at ${nodeTime} on ${new Date().toDateString()}`);
  clearInterval(timerInterval);
}

  if(nodeTime == dataObj.minus30Minutes){
    console.log(`api was called again at ${dataObj.minus30Minutes}`);
    //make api call and set new values to sunriseRegular
    fetch(`https://api.openweathermap.org/data/2.5/weather?zip=${dataObj.areaCode}&appid=e0da5a6ab2277de52533c75912e29264`).then((res) => {
      return res.json();
    }).then((data) => {
      let dt3 = data.sys.sunrise;
      let date3 = new Date(dt3 * 1000);
      // Catcher will catch the new time and save it.
      catcher=date3.toLocaleTimeString('en-US',{timeZone:dataObj.obj.location});
      console.log('new api call time:',catcher);
    })
    .catch(err=>console.log(err));
  };
// If our current time in our city is the same as sunrise time sent from weather Api send a text message
  if(nodeTime==catcher){

    let phoneNumber = dataObj.phone; // Replace with the recipient's phone number

    fetch('https://textbelt.com/text', {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: phoneNumber,
      message: 'Go out and get some sun!',
      key: textbeltApi,
    }),
  }).then(response => {
    return response.json();
  }).then(data => {
    console.log(data);
  }).catch(err=>console.log('ERROR: ',err));

}
};

// Will run our timer every second and we can unactive messages by
// calling clear timer in /clear-phone route
let timerInterval;
function timeInterval(dataObj){
  let date = new Date();
console.log('dataObj:',dataObj);
  let timerStart=date.toLocaleTimeString('en-US',{timeZone:dataObj.location});
  console.log(`timer started at ${timerStart} based on ${dataObj.location} time....`);
    timerInterval= setInterval(function(){time(dataObj)},1000);
};

app.listen(PORT, (res, req) => {
  console.log(`app.js is running on port ${PORT}`);
  db.any('SELECT * FROM users WHERE activation = $1', [
    'Message Activated'
  ]).then((data)=>{
  // console.log('data->',data);
  data.forEach((user)=>{
    console.log(user.username +' is sent to timeInterval');
    timeInterval(user.obj);
  })

  }).catch((err) => {
    console.log(err);
  });
});
