
const passport=require('passport');

const LocalStrategy= require('passport-local').Strategy;

const JwtStrategy = require('passport-jwt').Strategy;

const db=require('./database.js');

const bcrypt= require('bcrypt');

// extracts cookie in a custom way.
//uses that cookie for the session.
var cookieExtractor = function(req) {
    var token = null;
    if (req && req.cookies)
    {
        token = req.cookies['access_token'];
    }
    return token;
};

//everytime we go to a authenticated route we will check that our jwt is correct
//using jwtstrategy. It checks this by making sure jwt has secret_key to make sure
//it wasn't tampered with.
passport.use(new JwtStrategy({
  jwtFromRequest: cookieExtractor,
  secretOrKey:process.env.SECRET_KEY
}, function(payload, done) {
  if(payload){
    // crud - read
        db.any('SELECT * FROM users WHERE user_uid = $1',payload.sub)
        .then(function(user) {
        return done(null, user);
        })
        .catch(function(error) {
          if (error) {
              return done(err, false);
          }
          else {
              return done(null, false);
            }
        });
  }
else{
  console.log('jwt sends this message because there is no cookie');
}

}));
//Loging in
//we check if username exists
//if it does exists then we check if the password is the correct password and if
//it is then we reverse that password and authenticate.
passport.use(new LocalStrategy((username,password,done)=>{

  db.any('SELECT * FROM users WHERE username = $1', username)
  .then(function(user) {
    if(user.length == 0){
      console.log('no user found: !user statement')
      return done(null, false,{message:'Username not found. Please retry.'});
    }
    let hashed=user[0].password;

    bcrypt.compare(password,hashed)
    .then(function (result){
      if(!result){
        console.log('does not match');
        return done(null, false,{message:'Password does not match. Please retry.'});
      }
        return done(null, user);
    })

  })
  .catch(function(error) {
    if (error) { return done(error); }
  });
}));
