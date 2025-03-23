const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, text, html) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      secure: true,
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: `Healworld Support <${process.env.MAIL_USERNAME}>`,
      to,
      subject,
      text,
      html,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}`);
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error);
    throw new Error("Failed to send email");
  }
};

// ฟังก์ชันสำหรับส่งอีเมลยืนยัน
const sendVerifyEmail = async (email, verifyLink) => {
  const subject = "Verify Your Email - Healworld";
  const text = `Click the link to verify your email: ${verifyLink}`;
  const html = `
        <p>Hi,</p>
        <p>Thank you for registering with Healworld.me.</p>
        <p>Please click the link below to verify your email:</p>
        <a href="${verifyLink}" target="_blank">Verify Email</a>
        <p>This link is valid for 10 minutes.</p>
        <p>Healworld.me Team</p>
    `;
  await sendEmail(email, subject, text, html);
};

// ฟังก์ชันสำหรับส่งอีเมลตั้งรหัสผ่าน
// ฟังก์ชันสำหรับส่งอีเมลตั้งรหัสผ่าน
const sendSetPasswordEmail = async (email, setPasswordLink) => {
  const subject = "Set Your Password - Healworld";
  const text = `Click the link to set your password: ${setPasswordLink}`;
  const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <p>Hi,</p>
            <p>You have made a booking on <strong>Healworld.me</strong> using this email.</p>
            <p>Please set your password by clicking the button below:</p>
            <a href="${setPasswordLink}" target="_blank" style="
                display: inline-block;
                background-color: #28a745;
                color: #fff;
                text-decoration: none;
                padding: 10px 20px;
                border-radius: 5px;
                font-size: 16px;
                font-weight: bold;
            ">
                Set Password
            </a>
            <p style="margin-top: 20px;">Once you set your password, your email will be verified automatically.</p>
            <p>This link is valid for <strong>10 minutes</strong>.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="font-size: 12px; color: #888;">If you did not request this, please ignore this email.</p>
            <p style="font-size: 12px; color: #888;">&copy; 2025 Healworld.me Team</p>
        </div>
    `;
  await sendEmail(email, subject, text, html);
};


// Export ฟังก์ชันทั้งหมด
module.exports = { sendVerifyEmail, sendSetPasswordEmail };
