const pool = require("./src/config/db");

const {
    createPasswordResetToken
} = require("./src/utils/passwordResetUtils");

async function test() {
    try {
        const userId = 1;

        const token = await createPasswordResetToken(userId);

        console.log("Reset token generated successfully.");
        console.log("Token length:", token.length);

        const result = await pool.query(
            `SELECT user_id, token_hash, expires_at, used_at
             FROM password_reset_tokens
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [userId]
        );

        console.log("Database record:", result.rows[0]);

    } catch (error) {
        console.error("Test failed:", error.message);
    } finally {
        await pool.end();
    }
}

test();
