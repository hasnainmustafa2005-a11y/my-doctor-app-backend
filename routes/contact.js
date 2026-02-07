// routes/contact.js
import express from "express";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

router.post("/contact", async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.zoho.eu",      // use smtp.zoho.com if not EU
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER, // info@connectdoc.ie
        pass: process.env.EMAIL_PASS, // Zoho App Password
      },
    });

    await transporter.sendMail({
      from: `"ConnectDoc Website" <${process.env.EMAIL_USER}>`, // MUST be Zoho email
      to: process.env.EMAIL_USER,
      replyTo: email, // visitor email
      subject: `[Contact] ${name} <${email}>`,
      html: `
        <h3>New Contact Message</h3>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Subject:</b> ${subject}</p>
        <p><b>Message:</b><br/>${message}</p>
      `,
    });

    res.json({ message: "Message sent successfully!" });
  } catch (err) {
    console.error("Email error:", err);
    res.status(500).json({ message: "Failed to send message" });
  }
});

export default router;
