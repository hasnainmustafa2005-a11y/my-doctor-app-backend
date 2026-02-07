import nodemailer from "nodemailer";

const sendOtpEmail = async (toEmail, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.zoho.eu", // Zoho SMTP host for EU (use smtp.zoho.com for US)
    port: 587, // TLS port
    secure: false, // or Outlook, etc.
      auth: {
        user: process.env.EMAIL_USER, // your email
        pass: process.env.EMAIL_PASS, // app password
      },
    });

const mailOptions = {
  from: `"ConnectDoc Telehealth" <${process.env.EMAIL_USER}>`,
  to: toEmail,
  subject: `${otp} is your ConnectDoc verification code`,
  text: `
ConnectDoc Telehealth
---------------------------------------

Hello,

To complete your login, please enter the following verification code on the login screen:

VERIFICATION CODE: ${otp}

This code is valid for 2 minutes and can only be used once.

Security Note:
For your protection, never share this code with anyone. ConnectDoc support will never ask for this code over the phone or via email. If you did not request this code, please ignore this message or contact our security team if you have concerns.

Thank you,
The ConnectDoc Team
https://www.connectdoc.example (Replace with your actual URL)

© ${new Date().getFullYear()} ConnectDoc Telehealth. All rights reserved.
  `,
};


    await transporter.sendMail(mailOptions);
    console.log("📧 OTP email sent to", toEmail);
  } catch (error) {
    console.error("❌ Email send failed:", error);
    throw error;
  }
};

export default sendOtpEmail;
