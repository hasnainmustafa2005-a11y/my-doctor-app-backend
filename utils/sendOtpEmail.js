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
  from: `"ConnectDoc" <${process.env.EMAIL_USER}>`,
  to: toEmail,
  subject: `${otp} is your ConnectDoc verification code`,
  html: `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e7ff; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #1e293b; padding: 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">ConnectDoc</h1>
        <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 12px; uppercase; letter-spacing: 2px;">Telehealth Services</p>
      </div>

      <div style="padding: 40px 30px; background-color: #ffffff;">
        <h2 style="color: #1e293b; margin-top: 0;">Verification Code</h2>
        <p style="color: #475569; line-height: 1.6;">Hello,</p>
        <p style="color: #475569; line-height: 1.6;">To complete your secure login, please use the following verification code. This code is valid for <b>2 minutes</b>.</p>
        
        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #2563eb;">${otp}</span>
        </div>

        <p style="color: #64748b; font-size: 13px; font-style: italic;">
          <b>Security Note:</b> For your protection, never share this code. ConnectDoc staff will never ask for this code via phone or email.
        </p>
      </div>

      <div style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="color: #475569; font-size: 14px; margin-bottom: 20px;">Stay connected with us:</p>
        
        <div style="margin-bottom: 20px;">
          <a href="https://www.facebook.com/ConnectDoc" style="text-decoration: none; margin: 0 10px;">
            <img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" width="24" height="24" alt="Facebook">
          </a>
          <a href="https://instagram.com/yourprofile" style="text-decoration: none; margin: 0 10px;">
            <img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" width="24" height="24" alt="Instagram">
          </a>
          <a href="https://linkedin.com/company/yourcompany" style="text-decoration: none; margin: 0 10px;">
            <img src="https://cdn-icons-png.flaticon.com/512/3536/3536505.png" width="24" height="24" alt="LinkedIn">
          </a>
        </div>

        <p style="color: #94a3b8; font-size: 12px;">
          &copy; ${new Date().getFullYear()} ConnectDoc Telehealth. All rights reserved.<br>
          <a href="https://www.connectdoc.ie" style="color: #3b82f6; text-decoration: none;">Visit our Website</a> | 
          <a href="https://www.connectdoc.ie/privacy" style="color: #3b82f6; text-decoration: none;">Privacy Policy</a>
        </p>
      </div>
    </div>
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
