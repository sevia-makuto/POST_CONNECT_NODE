require("dotenv").config();

//importing express
const express = require('express');


const cors = require("cors");
const app = express();
const helmet = require("helmet");
// HTTP security headers
const helmetOptions = {
    strictTransportSecurity:
        process.env.NODE_ENV === "production"
            ? undefined
            : false
};

app.use(helmet(helmetOptions));

const allowedOrigins = [
    process.env.CLIENT_URL
];


app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"]
}));
//defining the port and host for easing running of the server
const port = process.env.PORT || 3000;
const host = 'localhost';
//configure session
const session = require("express-session");//express-session provides session management for Express.
const PgSession = require("connect-pg-simple")(session);//express-session provides session management for Express.

//import database configuration and connections
const pool = require('./config/db.js');
//importing middleware configurationp
const logger = require('./middleware/logger.js');
const authMiddleware = require('./middleware/authMiddleware.js');
const errorHandler = require('./middleware/errorHandler.js');


// const validAccount = require('./middleware/validAccount.js')
const validAccountId = require('./middleware/validAccountId.js');

// const validatePagination = require('./middleware/validatePagination');
const authRoutes = require("./routes/authRoutes");
const requireAuth = require("./middleware/requireAuth.js");
const requireRole = require("./middleware/requireRole.js");




// Middleware
app.use(express.json());



app.use(
    session({
        name :"bank.sid",
        secret:process.env.SESSION_SECRET,
        resave:false,
        saveUninitialized:false,
        store: new PgSession({
            pool: pool,
            createTableIfMissing:true
        }),
        cookie:{
            httpOnly:true,//prevent js from reading the cookie
            secure:process.env.NODE_ENV === 'production',//sends on secures https
            sameSite:"none",//help protect against some cross site
            maxAge:1000*60*60,//last for how long
            path:"/"//patth to follow
        }
    })
)


app.use(logger);
app.use("/auth", authRoutes);



//protected router

app.get('/protected',authMiddleware,(req,res) => {
    res.json({
        message:"you have accessed a protected route"
    });
});

// Home route
app.get('/', (req, res) => {
    res.json({
        message: "Bank API is running successfully"
    });
});

// Test database connection
app.get('/db-test', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');

        res.json({
            message: "Database connection successful",
            time: result.rows[0].now
        });

    } catch (err) {
        console.error('Database connection error:', err.message);

        res.status(500).json({
            message: "Database connection failed"
        });
    }
});

// Get all accounts
app.get('/accounts',authRoutes, async (req, res) => {
    try {
        // Execute SQL query
        const results = await pool.query(
            'SELECT * FROM bank_accounts ORDER BY id'
        );

        // Return accounts
        res.status(200).json({
            message: "Accounts retrieved successfully",
            accounts: results.rows
        });

    } catch (error) {
        console.error("Error retrieving accounts:", error.message);

        res.status(500).json({
            message: "Failed to retrieve accounts"
        });
    }
});


// app.get('/accounts', validatePagination, async (req, res, next) => {
//     try {
//         const { limit, offset } = req.pagination;

//         const result = await pool.query(
//             `SELECT *
//              FROM bank_accounts
//              ORDER BY id
//              LIMIT $1 OFFSET $2`,
//             [limit, offset]
//         );

//         res.json({
//             accounts: result.rows,
//             pagination: {
//                 limit,
//                 offset
//             }
//         });

//     } catch (error) {
//         next(error);
//     }
// });

// GET account by ID
app.get('/accounts/:id', authRoutes,async (req, res) => {
    try {
        // Get account ID from URL
        const id = req.params.id;

        // Query database
        const result = await pool.query(
            'SELECT * FROM bank_accounts WHERE id = $1',
            [id]
        );

        // Check whether account exists
        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'Account not found'
            });
        }

        // Return account
        res.status(200).json({
            message: 'Account retrieved successfully',
            account: result.rows[0]
        });

    } catch (error) {
        console.error('Error retrieving account:', error.message);

        res.status(500).json({
            message: 'Failed to retrieve account'
        });
    }
});

// POST - Create a new bank account
app.post('/accounts',authRoutes,async (req, res,next) => {
    try {
        // Extract data from request body
        const { account_name, balance } = req.body;

        // Validate input
        if (!account_name || balance === undefined) {
            return res.status(400).json({
                message: 'Account name and balance are required'
            });
        }

        // Validate account name
        if (typeof account_name !== 'string' || account_name.trim() === '') {
            return res.status(400).json({
                message: 'Account name must be a valid string'
            });
        }

        // Validate balance
        const accountBalance = Number(balance);

        if (!Number.isFinite(accountBalance) || accountBalance < 0) {
            return res.status(400).json({
                message: 'Balance must be a valid non-negative number'
            });
        }

        // // Insert account into PostgreSQL
        const result = await pool.query(
            `INSERT INTO bank_accounts (account_name, balance)
             VALUES ($1, $2)
             RETURNING *`,
            [account_name.trim(), accountBalance]
        );

        // Return created account
        res.status(201).json({
            message: 'Account created successfully',
            account: result.rows[0]
        });

    } catch (error) {
        // console.error('Error creating account:', error.message);

        // res.status(500).json({
        //     message: 'Failed to create account'
        // });
        next(error);
    }
});

// PATCH - Update an existing bank account
app.patch('/accounts/:id', authRoutes,validAccountId,async (req, res) => {
    try {
        // Get account ID from URL
        const { id } = req.params;

        // Get update data from request body
        const { account_name, balance } = req.body;

        // Validate ID
        if (!/^[1-9]\d*$/.test(id)) {
            return res.status(400).json({
                message: 'Invalid account ID'
            });
        }

        // Ensure at least one field was provided
        if (account_name === undefined && balance === undefined) {
            return res.status(400).json({
                message: 'Provide account_name or balance to update'
            });
        }

        // Validate account name if provided
        if (
            account_name !== undefined &&
            (typeof account_name !== 'string' || account_name.trim() === '')
        ) {
            return res.status(400).json({
                message: 'Account name must be a non-empty string'
            });
        }

        // Validate balance if provided
        if (balance !== undefined) {
            const numericBalance = Number(balance);

            if (!Number.isFinite(numericBalance) || numericBalance < 0) {
                return res.status(400).json({
                    message: 'Balance must be a valid non-negative number'
                });
            }
        }

        // Build update dynamically using fixed SQL fragments
        const fields = [];
        const values = [];

        if (account_name !== undefined) {
            values.push(account_name.trim());
            fields.push(`account_name = $${values.length}`);
        }

        if (balance !== undefined) {
            values.push(Number(balance));
            fields.push(`balance = $${values.length}`);
        }

        // Add account ID as final parameter
        values.push(id);

        const query = `
            UPDATE bank_accounts
            SET ${fields.join(', ')}
            WHERE id = $${values.length}
            RETURNING *
        `;

        const result = await pool.query(query, values);

        // Check whether account exists
        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'Account not found'
            });
        }

        res.status(200).json({
            message: 'Account updated successfully',
            account: result.rows[0]
        });

    } catch (error) {
        console.error('Error updating account:', error.message);

        res.status(500).json({
            message: 'Failed to update account'
        });
    }
});

 // DELETE - Remove a bank account
app.delete('/accounts/:id',authRoutes, async (req, res) => {
    try {
        // Get account ID from URL
        const { id } = req.params;

        // Validate account ID
        if (!/^[1-9]\d*$/.test(id)) {
            return res.status(400).json({
                message: 'Invalid account ID'
            });
        }

        // Delete account from PostgreSQL
        const result = await pool.query(
            'DELETE FROM bank_accounts WHERE id = $1 RETURNING *',
            [id]
        );

        // Check if account exists
        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'Account not found'
            });
        }

        // Return deleted account
        res.status(200).json({
            message: 'Account deleted successfully',
            account: result.rows[0]
        });

    } catch (error) {
        console.error('Error deleting account:', error.message);

        res.status(500).json({
            message: 'Failed to delete account'
        });  
        
    }
});
// Handle requests to unknown routes
app.use((req, res, next) => {
    const error = new Error(
        `Route not found: ${req.method} ${req.originalUrl}`
    );

    error.statusCode = 404;

    next(error);
});

// Centralized error handler (must be last)
app.use(errorHandler);



// Start server
app.listen(port,'0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});
