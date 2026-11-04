//import pool
const {Pool} = require('pg');
//load environment variables
require('dotenv').config();
//create a connection
const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
})

//check connection
pool.on('connect', () =>{
    console.log('Database connected successfully');
})

//handle connection errors
pool.on('error', (err) =>{
    console.error('Database connection error:', err);
    process.exit(-1);
})

module.exports = pool;