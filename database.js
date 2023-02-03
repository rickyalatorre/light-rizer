

const pgp = require('pg-promise')();

const db = pgp('postgres://postgres:pulga@localhost:5432/onehabit');

module.exports = db;
