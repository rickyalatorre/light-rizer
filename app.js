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
app.set("view engine", "ejs");

app.use(cookieParser());

app.use(express.json());

const uid = require('uuid');

app.use(express.static("public"));

const JWT = require('jsonwebtoken');
//telling our server that we want to be able to access forms in html pages inside our request.
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

const port = 3100;

const db = require('./database.js');

const accountSid = process.env.ACCOUNT_SID;

const authToken= process.env.AUTH_TOKEN;

const client = require('twilio')(accountSid, authToken);

//jwt will be made with secret_key. Our server checks that secret_key is still
//inside jwt to make sure no one tampered with it.
const signToken = (userID) => {
  return JWT.sign({
    iss: process.env.SECRET_KEY,
    sub: userID
    //removing expiresIn: '24h' from {} so the token does not expire.
  }, process.env.SECRET_KEY, {})
};

let authenticated = false;

//user to display on navbar
let userName;

let phoneActivation='Messages Unactivated';

// If authenticated then we will remove login and register button from bottom of the page.
// Will convert navabar into authenticated navbar
app.get("/", function(req, res) {

  if (authenticated) {
    res.render('index', {
      message: true,
      username:userName
    })
  } else {
    res.render('index', {
      message: false,
      username:''
    })
  }
});

// Will return to /profile if manually typed in when authenticated.
app.get('/register-page', function(req, res) {
  if (authenticated) {
    res.redirect('/profile');
  } else {
    res.render('register', {
      message: false,
      taken:'',
      username:''
    });
  }
});

// Will return to /profile if manually typed in when authenticated.
app.get('/login-page', function(req, res) {

  if (authenticated) {
    res.redirect('/profile')
  }
  else {
    res.render('login', {
      message: false,
      username:'',
      messageFailure:''
    });
  }
});

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

app.post('/login', function(req, res, next) {
  passport.authenticate('local', { session: false }, function(err, user, info) {
    if (err) {
      console.log('error---->',error)
      res.render('login', {
        message: false,
        username:'',
        messageFailure:error
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

      authenticated = true;
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
    username:userName
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
  if(phone!==''){
    phoneActivation='Messages Activated';
  }

  let phoneUS= `+1${phone}`;
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

// Updating zip code and phone number and or activating messages
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
});

app.get("/logout", passport.authenticate('jwt', {
  failureRedirect: '/login-page',
  session: false
}), (req, res) => {
  res.clearCookie('access_token');
  authenticated = false;
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
      messagesActivated:phoneActivation,
      name: req.user[0].username,
      phone: req.user[0].phone,
      areaCode: req.user[0].areacode,
      sunriseMessage: `<span>The sun will rise at <span class="unbreak">${req.user[0].time}</span> in <span class="unbreak">${req.user[0].city}</span></span>`,
      message: true,
      username:userName
    });
  } else {
    res.render('profile', {
      messagesActivated:phoneActivation,
      name: req.user[0].username,
      phone: req.user[0].phone,
      areaCode: req.user[0].areacode,
      sunriseMessage: '<a href="/settings">Click here to set up your phone number and zip code</a>',
      message: true,
      username:userName
    });
  }

});

//Unactivated to profile
app.post('/clear-phone',passport.authenticate('jwt', {
  failureRedirect: '/login-page',
  session: false
}), (req, res)=>{
  phoneActivation='Messages Unactivated';
clearInterval(timerInterval);
res.redirect('/profile');
});

app.use(passport.initialize());

// Catcher will catch the new time 30 min before sunrise time
let catcher;
function time(dataObj){ //runs every second.

let nodeTime= new Date().toLocaleTimeString('en-US',{timeZone:dataObj.location});
// When current time equals to 30 min before sunrise call weather api again to get
// any new time the sun will rise
  if(nodeTime == dataObj.minus30Minutes()){
    console.log(`api was called again at ${dataObj.minus30Minutes()}`);
    //make api call and set new values to sunriseRegular
    fetch(`https://api.openweathermap.org/data/2.5/weather?zip=${dataObj.areaCode}&appid=e0da5a6ab2277de52533c75912e29264`).then((res) => {
      return res.json();
    }).then((data) => {
      let dt3 = data.sys.sunrise;
      let date3 = new Date(dt3 * 1000);
      // Catcher will catch the new time and save it.
      catcher=date3.toLocaleTimeString('en-US',{timeZone:dataObj.location});
    })
    .catch(err=>console.log(err));
  };
// If our current time in our city is the same as sunrise time sent from weather Api send a text message
  if(nodeTime==catcher){
    client.messages
      .create({
         body: 'The sun is out! go get some light',
         from: '+15626008651',
         to: dataObj.phone
       })
      .then(message =>{
         console.log(`message sent to ${dataObj.phone}. its ${catcher}!!`);
       })
       .catch((err)=>console.log('reason we fail sending:',err));
  };

};

// Will run our timer every second and we can unactive messages by
// calling clear timer in /clear-phone route
let timerInterval;
function timeInterval(dataObj){
    timerInterval= setInterval(function(){time(dataObj)},1000);
};

app.listen(port, (res, req) => {
  console.log(`app.js is running on port ${port}`);
});
