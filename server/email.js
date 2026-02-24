'use strict';
const nodemailer = require('nodemailer');

let transporter = null;
const isConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

if (isConfigured) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: (process.env.SMTP_PORT || '587') === '465',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const fromAddress = process.env.SMTP_FROM || 'noreply@othello.local';

async function sendResetEmail(toEmail, token) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const resetUrl = `${baseUrl}/?reset=${token}`;

  if (!isConfigured) {
    console.log('\n=== PASSWORD RESET (Dev Mode) ===');
    console.log(`Email: ${toEmail}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log('================================\n');
    return { ok: true, dev: true };
  }

  await transporter.sendMail({
    from: fromAddress,
    to: toEmail,
    subject: 'Othello Online - Password Reset',
    html: `<h2>Password Reset</h2><p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, ignore this email.</p>`,
  });

  return { ok: true };
}

module.exports = { sendResetEmail };
