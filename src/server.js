//import express from 'express';
const express = require('express');
const app = express();
const port = 3000;
const host = 'localhost';
//import pool from './config/db.js';
const pool = require('./config/db.js');

//middleware
app.use(express.json());

//routes
app.get('/', (req , res) => {
    res.json({
        message:"Bank API is running successfully"
    })
})

//test connection to database
app.get("/db-test", async (req , res) =>{
    try{
        const result = await pool.query('SELECT NOW()');
        res.json({
            message: "Database connection successful",
            time: result.rows[0].now
        })

    }catch(err)
    {
        console.error('Database connection error:', err);
        res.status(500).json({
            message: "Database connection failed"
        })
    }
})

//start server
app.listen(port, () => {
    console.log(`Server is running on http://${host}:${port}`);
})