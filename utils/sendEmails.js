import nodemailer from "nodemailer";

const sendEmail = async (to, subject, otp) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.zoho.eu", 
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Professional Plain-Text Content
  const textContent = `
CONNECTDOC ADMIN PORTAL
---------------------------------------

Hello Admin,

A login attempt to your ConnectDoc Admin Dashboard was initiated. 
Please use the One-Time Password (OTP) below to authenticate:

ADMIN ACCESS CODE: ${otp}

This code is valid for 10 minutes.

For security reasons, do not share this code with anyone. If you did not initiate this login request, please contact your IT security administrator immediately.

Best regards,
ConnectDoc Security Team

---------------------------------------
© ${new Date().getFullYear()} ConnectDoc Telehealth. All rights reserved.
  `;

  try {
    await transporter.sendMail({
      from: `"ConnectDoc Admin Portal" <${process.env.EMAIL_USER}>`,
      to,
      subject: `[Admin Security] ${otp} is your verification code`,
      text: textContent, // Only sending text version
    });
    console.log("📧 Admin OTP email sent successfully");
  } catch (error) {
    console.error("❌ Admin Email failed:", error);
    throw error;
  }
};

export default sendEmail;