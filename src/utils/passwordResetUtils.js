
const pool = require("../config/db");

const {
    generateResetToken,
    hashResetToken
} = require("./tokenUtils");

async function createPasswordResetToken(userId) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Generate original token
        const resetToken = generateResetToken();

        // Remove previous unused tokens
        await client.query(
            `DELETE FROM password_reset_tokens
             WHERE user_id = $1 AND used_at IS NULL`,
            [userId]
        );

        // Hash original token
        const tokenHash = hashResetToken(resetToken);

        // Token expires after 15 minutes
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        // Store hashed token using the same transaction client
        await client.query(
            `INSERT INTO password_reset_tokens
             (user_id, token_hash, expires_at)
             VALUES ($1, $2, $3)`,
            [userId, tokenHash, expiresAt]
        );

        // Commit transaction
        await client.query("COMMIT");

        return resetToken;

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;

    } finally {
        client.release();
    }
}

module.exports = {
    createPasswordResetToken
};
