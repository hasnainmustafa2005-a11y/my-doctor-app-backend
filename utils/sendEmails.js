import nodemailer from "nodemailer";

const sendEmail = async (to, subject, otp) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // HTML content for OTP email
  const htmlContent = `
  <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f9fafb;">
    <h2 style="color: #1e3a8a; text-align: center;">ConnectDoc Admin Portal</h2>
    <p style="text-align: center; color: #374151;">Hello Admin,</p>
    <p style="color: #374151; line-height: 1.6;">
      You requested a one-time password (OTP) to access your admin dashboard. Use the code below to login securely:
    </p>

    <div style="text-align: center; margin: 20px 0;">
      <span style="display: inline-block; font-size: 32px; font-weight: bold; color: #1e3a8a; background-color: #dbeafe; padding: 10px 20px; border-radius: 8px; letter-spacing: 4px;">
        ${otp}
      </span>
    </div>

    <p style="color: #6b7280; line-height: 1.6;">
      This OTP is valid for <strong>10 minutes</strong>. Do not share it with anyone.
    </p>

    <p style="color: #374151; line-height: 1.6;">
      If you did not request this, please ignore this email.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />

    <p style="text-align: center; color: #6b7280; font-size: 12px;">
      ConnectDoc - Telehealth Admin Portal<br />
      &copy; ${new Date().getFullYear()} ConnectDoc. All rights reserved.
    </p>
  </div>
  `;

  await transporter.sendMail({
    from: `"ConnectDoc Admin Portal" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: htmlContent,
  });
};

export default sendEmail;
