
const express = require("express");
const bcrypt = require("bcrypt");
const { z, success } = require("zod");
const pool = require("../config/db");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");
const {
    generateToken,
    csrfSynchronisedProtection
} = require("../middleware/csrfMiddleware");
const { loginLimiter } =
    require("../middleware/rateLimitMiddleware");
    const {
    createPasswordResetToken
} = require("../utils/passwordResetUtils");

const {
    sendPasswordResetEmail
} = require("../utils/emailUtils");
const { hashResetToken } = require("../utils/tokenUtils");

const router = express.Router();

// Validate registration input
const registerSchema = z.object({
    username: z.string()
        .trim()
        .min(3, "Username must be at least 3 characters")
        .max(50, "Username must be at most 50 characters")
        .regex(/^[a-zA-Z0-9_]+$/, "Username can contain only letters, numbers, and underscores"),

    email: z.string()
        .trim()
        .email("Enter a valid email address")
        .max(255),

    password: z.string()
        .min(8, "Password must be at least 8 characters")
        .refine(
            password => Buffer.byteLength(password, "utf8") <= 72,
            "Password must be at most 72 bytes"
        )
});

// POST /auth/register
router.post("/register", async (req, res, next) => {
    try {
        // 1. Validate the request body
        const validation = registerSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                success: false,
                errors: validation.error.issues.map(issue => ({
                    field: issue.path.join("."),
                    message: issue.message
                }))
            });
        }

        const { username, email, password } = validation.data;

        // 2. Hash the password
        const passwordHash = await bcrypt.hash(password, 12);

        // 3. Save the user in PostgreSQL
        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, username, email, role, created_at`,
            [username, email.toLowerCase(), passwordHash]
        );

        // 4. Return the created user (never the password/hash)
        return res.status(201).json({
            success: true,
            message: "Registration successful",
            user: result.rows[0]
        });

    } catch (error) {
        // PostgreSQL unique-constraint violation
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "Username or email already exists"
            });
        }

        next(error);
    }
});

const loginSchema = z.object({
    email: z.string().trim().email("Enter a valid email address"),
    password: z.string().min(1, "Password is required")
});

// POST /auth/login
router.post("/login",loginLimiter, async (req, res, next) => {
    try {
        // 1. Validate input
        const validation = loginSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                success: false,
                errors: validation.error.issues.map(issue => ({
                    field: issue.path.join("."),
                    message: issue.message
                }))
            });
        }

        const { email, password } = validation.data;

        // 2. Find the user by email
        const result = await pool.query(
            `SELECT id, username, email, role,password_hash
             FROM users
             WHERE email = $1`,
            [email.toLowerCase()]
        );

        // 3. Reject if user does not exist
        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const user = result.rows[0];

        // 4. Compare submitted password with stored bcrypt hash
        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );
       

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }



       //regerate the session id after a succeful login
       req.session.regenerate((err) =>{
        if(err){
            return next(err);
        }
        //store only the user identity and role in the response
        req.session.userId = user.id;
        req.session.role = user.role;

        //save the session before sending the response
        req.session.save((err) =>{
            if(err){
                return next(err);
            }
             // 5. Return public user information
        return res.status(200).json({
            success: true,
            message: "Login successful",
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
     });
});

    } catch (error) {
        next(error);
    }
});

router.get("/csrf-token", requireAuth, (req, res) => {
    const token = generateToken(req);

    return res.status(200).json({
        success: true,
        csrfToken: token
    });
});
const forgotPasswordSchema = z.object({
    email: z.string()
        .trim()
        .email("Enter a valid email address")
});

router.post("/forgot-password", async (req, res, next) => {
    try {
        // Validate email
        const validation = forgotPasswordSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                success: false,
                errors: validation.error.issues
            });
        }

        const email = validation.data.email.toLowerCase();

        // Find user
        const result = await pool.query(
            `SELECT id, email
             FROM users
             WHERE email = $1`,
            [email]
        );

        // Use the same response whether the account exists or not
        const response = {
            success: true,
            message: "If an account exists with that email, password reset instructions will be sent."
        };

        if (result.rows.length === 0) {
            return res.status(200).json(response);
        }

        const user = result.rows[0];

        // Generate and store reset token
        const resetToken =
            await createPasswordResetToken(user.id);

        // Send reset email
        await sendPasswordResetEmail(
            user.email,
            resetToken
        );

        return res.status(200).json(response);

    } catch (error) {
        next(error);
    }
});

const resetPasswordSchema = z.object({
    token: z.string()
        .regex(/^[a-f0-9]{64}$/i, "Invalid reset token"),

    newPassword: z.string()
        .min(8, "Password must be at least 8 characters")
        .refine(
            password => Buffer.byteLength(password, "utf8") <= 72,
            "Password must not exceed 72 bytes"
        )
});router.post("/reset-password", async (req, res, next) => {
    const validation = resetPasswordSchema.safeParse(req.body);

    if (!validation.success) {
        return res.status(400).json({
            success: false,
            errors: validation.error.issues.map(issue => ({
                field: issue.path.join("."),
                message: issue.message
            }))
        });
    }

    const { token, newPassword } = validation.data;

    // Hash the original token received from the user
    const tokenHash = hashResetToken(token);

    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Find a valid, unused, unexpired reset token
        const tokenResult = await client.query(
            `SELECT id, user_id
             FROM password_reset_tokens
             WHERE token_hash = $1
               AND expires_at > NOW()
               AND used_at IS NULL
             FOR UPDATE`,
            [tokenHash]
        );

        if (tokenResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Invalid or expired password reset token"
            });
        }

        const resetRecord = tokenResult.rows[0];

        // Update the user's password
        await client.query(
            `UPDATE users
             SET password_hash = $1
             WHERE id = $2`,
            [passwordHash, resetRecord.user_id]
        );

        // Mark the reset token as used
        await client.query(
            `UPDATE password_reset_tokens
             SET used_at = NOW()
             WHERE id = $1`,
            [resetRecord.id]
        );

        // Invalidate all existing sessions for this user
        await client.query(
            `DELETE FROM "session"
             WHERE sess->>'userId' = $1`,
            [String(resetRecord.user_id)]
        );

        await client.query("COMMIT");

        return res.status(200).json({
            success: true,
            message: "Password reset successfully. Please log in again."
        });

    } catch (error) {
        await client.query("ROLLBACK");
        next(error);

    } finally {
        client.release();
    }
});


router.post("/logout", requireAuth,
    csrfSynchronisedProtection,  async(req,res,next) =>{
    try{
        //get user 
        const userId = req.session.userId;
        console.log("User ID:", userId);
    
        //find the username before destroying the session
        const result = await pool.query(
            "SELECT username FROM users WHERE id =$1",
            [userId]
        );
          console.log("Database result:", result.rows);
        const username = result.rows[0]?.username || "User";

    //destroy session
    req.session.destroy((error) =>{
        if(error){
            return next(error);
        }
        res.clearCookie("bank.sid",{
            httpOnly:true,
            secure:process.env.NODE_ENV === "production",
            sameSite:"lax",
            path:"/"
        })
        res.status(200).json({
            success:true,
            message:`Logout successfully ${username}`
        });
    });
}catch(error){
    next(error);
}
})






router.get("/profile",requireAuth,async(req,res,next) =>{
    try{
        const result = await pool.query(
            `SELECT id,username,email,role,password_hash,created_at
            FROM users
            WHERE id=$1`,
            [req.session.userId]
        );
         if (result.rows.length === 0) {
            return res.status(4044).json({
                success: false,
                message: "User not found"
            });
        }
            res.status(200).json({
                success:true,
                user:result.rows[0]

            });


    }catch(error){
        next(error);

    }
});
router.get("/admin",requireAuth,requireRole("admin"),(req ,res) =>{
     return res.status(200).json({
        success:true,
        massege:"Welcome to administartion dashboard",
        role:req.session.role
    });
   

}

);
// router.get("/csrf-token",requireAuth,(req,res) =>{
//     const token = generateToken(req);
//     return res.status(200).json({
//         success:true,
//         csrfToken:token
//     });
// });


module.exports = router;
