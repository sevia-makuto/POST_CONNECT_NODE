const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",

    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

async function sendPasswordResetEmail(email, resetToken) {
    const resetLink =
        `${process.env.APP_BASE_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;

    await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: email,
        subject: "Bank API - Password Reset",

        text: `Use this link to reset your password. It expires in 15 minutes: ${resetLink}`,

        html: `
            <h2>Password Reset</h2>
            <p>You requested a password reset.</p>
            <p>
                <a href="${resetLink}">
                    Reset your password
                </a>
            </p>
            <p>This link expires in 15 minutes.</p>
            <p>If you did not request this, ignore this email.</p>
        `
    });
}

module.exports = {
    sendPasswordResetEmail
};