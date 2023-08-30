const pgp = require('pg-promise')();

// const db = pgp(process.env.DATABASE_URL);

const cn = {
  connectionString: process.env.DATABASE_URL,
  max: 20,
  ssl: {
    rejectUnauthorized: false
  }
};
var db = pgp(cn);

module.exports = db;
