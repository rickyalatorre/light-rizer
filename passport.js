
const passport=require('passport');

const LocalStrategy= require('passport-local').Strategy;

const JwtStrategy = require('passport-jwt').Strategy;
const db=require('./database.js');
// const pgp = require('pg-promise')(/* options */)
// const db = pgp('postgres://postgres:pulga@localhost:5432/onehabit')
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

passport.use(new JwtStrategy({
  jwtFromRequest: cookieExtractor,
  secretOrKey:process.env.SECRET_KEY
}, function(payload, done) {
  if(payload){
    console.log('inside jwt strategy');
    // crud - read
        db.any('SELECT * FROM users WHERE user_uid = $1',payload.sub)

        .then(function(user) {
        return done(null, user);
        })
        .catch(function(error) {
          if (err) {
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
//////////////////LOGIN
//we check if username exists
//if it does exists then we check if the password is the correct password and if
//it is then we reverse that password and authenticate.

//if user doesnt exist then enter username and (hash/salted password) into the database
passport.use(new LocalStrategy((username,password,done)=>{
console.log('userNameReg:',username);
console.log('passwordReg:',password);
  db.any('SELECT * FROM users WHERE username = $1', username)
  .then(function(user) {
    if(user.length == 0){
      console.log('no user found: !user statement')
      return done(null, false,{message:'no user found'});
    }
    console.log('user param:',user);
    let hashed=user[0].password;
    console.log('hashed pass:',hashed);

    bcrypt.compare(password,hashed)
    .then(function (result){
      console.log('result:',result);
      if(!result){
        console.log('does not match');
        return done(null, false,{message:'password does not match'});
      }
        return done(null, user);
    })

  })
  .catch(function(error) {
    if (error) { return done(error); }
    if(!user){return done(null,false);}
  });
}));
