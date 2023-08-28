

const pgp = require('pg-promise')();

const db = pgp(process.env.LOCAL_POSTGRES || process.env.DATABASE_URL);
 // && process.env.DATABASE_URL

module.exports = db;
