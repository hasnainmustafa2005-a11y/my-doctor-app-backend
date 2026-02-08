import Doctor from "../models/Doctor.js"; // your doctor model
import crypto from "crypto";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";

let otpStore = {};
export const sendOtp = async (req, res) => {
  const { doctorId } = req.body;
  const adminEmail = req.admin?.email; // Provided by verifyAdmin middleware

  // 1. Validate doctorId is present
  if (!doctorId) {
    return res.status(400).json({ success: false, message: "Doctor ID is required." });
  }

  try {
    // 2. Find the doctor
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    // 3. Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    // 4. Save to Doctor record
    doctor.otp = otp;
    doctor.otpExpiry = otpExpiry;
    await doctor.save({ validateBeforeSave: false });

    // 5. Send Email to Admin
    let transporter = nodemailer.createTransport({
      host: "smtp.zoho.eu",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"ConnectDoc Security" <${process.env.EMAIL_USER}>`,
      to: adminEmail, 
      subject: "SECURITY: Doctor Password Reset OTP",
      text: `Admin, you are resetting the password for ${doctor.name}. \n\nYour OTP is: ${otp}`,
    });

    res.json({ success: true, message: `OTP sent to ${adminEmail}` });
  } catch (error) {
    console.error("OTP Error:", error);
    res.status(500).json({ success: false, message: "Server error during OTP dispatch" });
  }
};

export const resetDoctorPassword = async (req, res) => {
  const { doctorId, otp, newPassword } = req.body;

  // 1. Check if all data arrived
  if (!doctorId || !otp || !newPassword) {
    return res.status(400).json({ 
      success: false, 
      message: "Missing credentials (ID, OTP, or Password)." 
    });
  }

  try {
    // 2. Find the doctor record
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor record not found." });

    // 3. Verify OTP
    if (!doctor.otp || doctor.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid Security Token (OTP)." });
    }

    // 4. Check Expiry
    if (Date.now() > doctor.otpExpiry) {
      return res.status(400).json({ success: false, message: "Security Token has expired. Please resend." });
    }

    // 5. Hash New Password and Save
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    doctor.password = hashedPassword;
    
    // 6. IMPORTANT: Clear OTP fields so the same code can't be used twice
    doctor.otp = null;
    doctor.otpExpiry = null;
    
    await doctor.save({ validateBeforeSave: false });

    res.json({ success: true, message: "Practitioner account recovered successfully!" });
  } catch (err) {
    console.error("Reset Error:", err);
    res.status(500).json({ success: false, message: "Verification system failure." });
  }
};
// Get all doctors
export const getAllDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find().select("-password");
    res.json({ success: true, doctors });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

