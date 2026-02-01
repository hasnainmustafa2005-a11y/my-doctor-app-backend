import nodemailer from "nodemailer";

const sendOtpEmail = async (toEmail, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail", // or Outlook, etc.
      auth: {
        user: process.env.EMAIL_USER, // your email
        pass: process.env.EMAIL_PASS, // app password
      },
    });

 const mailOptions = {
  from: `"ConnectDoc Telehealth" <${process.env.EMAIL_USER}>`,
  to: toEmail,
  subject: "Your One-Time Login Code (OTP)",
  html: `
    <div style="font-family: 'Helvetica', Arial, sans-serif; color: #333; line-height: 1.6;">
      <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px; background-color: #f9f9f9;">
        <h2 style="color: #4f46e5; text-align: center;">ConnectDoc Telehealth</h2>
        <p style="text-align: center; font-size: 16px;">Hello,</p>
        <p style="text-align: center; font-size: 16px;">You requested to log in to your ConnectDoc account. Use the One-Time Password (OTP) below to proceed:</p>
        
        <h1 style="text-align: center; letter-spacing: 5px; font-size: 32px; color: #1f2937; margin: 20px 0;">${otp}</h1>

        <p style="text-align: center; font-size: 14px; color: #6b7280;">
          This OTP is valid for <b>2 minutes</b>. Please do not share it with anyone.
        </p>

        <p style="text-align: center; font-size: 14px; color: #6b7280; margin-top: 30px;">
          If you did not request this code, you can safely ignore this email.
        </p>

        <p style="text-align: center; font-size: 14px; color: #6b7280; margin-top: 20px;">
          — ConnectDoc Telehealth Team
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
