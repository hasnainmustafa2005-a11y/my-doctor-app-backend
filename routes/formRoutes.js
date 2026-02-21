import express from "express";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Form from "../models/Form.js";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";
const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "../tempPDFs");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
router.post("/send-pdf", async (req, res) => {
  try {
    const { name, email, phone,dob,
  address,
  age, pdfBase64, category, subCategory, questions } = req.body;

    if (!pdfBase64) {
      return res.status(400).json({ success: false, message: "Missing PDF data" });
    }

    // Convert base64 to PDF buffer
    const pdfBuffer = Buffer.from(pdfBase64.split(",")[1], "base64");

    // ✅ Save form as PENDING (NOT PAID)
    const newForm = new Form({
      name,
      email,
      phone,
      dob,        // ✅ ADD
      address,   // ✅ ADD
      age, 
      category,
      subCategory,
      questions,
      paymentStatus: "pending",
      status: "Pending",
      openedBy: [],  
    });

    await newForm.save();

    const io = req.app.get("io"); // Get the socketio instance from app
    if (io) {
      io.emit("formUpdated", { 
        message: "New Prescription Form Submitted", 
        formId: newForm._id 
      });
      console.log("📡 Socket emitted: formUpdated");
    }

    // Send email to admin (still OK)
    const transporter = nodemailer.createTransport({
       host: "smtp.zoho.eu", // Zoho SMTP host for EU (use smtp.zoho.com for US)
    port: 587, // TLS port
    secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"ConnectDoc Admin Portal" <${process.env.EMAIL_USER}>`,
      to: process.env.CLIENT_EMAIL,
      subject: `New ${subCategory || "Health"} Consultation Submitted (Pending Payment)`,
      text: `A new consultation form has been submitted.

Name: ${name}
Email: ${email}
Phone: ${phone}
Category: ${category}
Subcategory: ${subCategory}
`,
      attachments: [
        {
          filename: `${subCategory || "Consultation"}-${newForm._id}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    // ✅ Return MongoDB ID (THIS is your real reference)
    // /routes/formRoutes.js - inside /send-pdf
res.json({
  success: true,
  message: "Form saved. Awaiting payment.",
  formId: newForm._id,
});

  } catch (error) {
    console.error("❌ Error in /send-pdf:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});


router.get("/forms", async (req, res) => {
  try {
    const forms = await Form.find().sort({ createdAt: -1 });
    res.json(forms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Example route to mark form as paid
// PUT /api/forms/:id/mark-paid
// GET /api/forms/:id
// router.get("/forms/:id", async (req, res) => {
//   try {
//     const form = await Form.findById(req.params.id);
//     if (!form) return res.status(404).json({ error: "Form not found" });

//     res.json(form);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });


// GET form by ID
router.get("/forms/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) return res.status(400).json({ error: "Form ID is required" });

    const form = await Form.findById(id).lean();

    if (!form) return res.status(404).json({ error: "Form not found" });

    res.json({
      _id: form._id,
      name: form.name,
      email: form.email,
      phone: form.phone,
      category: form.category,
      subCategory: form.subCategory,
      questions: form.questions || [],
      paymentId: form.paymentId || "pending",
      paymentStatus: form.paymentStatus || "pending",
      createdAt: form.createdAt,
      sentDoctors: form.sentDoctors || [],
    });
  } catch (err) {
    console.error("Error fetching form:", err);
    res.status(500).json({ error: err.message });
  }
});

//
// 🔍 Route 3 — Search forms by Name, Email, or PDF ID
//
router.get("/forms/search", async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({ message: "Search query is required" });
    }

    const forms = await Form.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
        { pdfId: { $regex: query, $options: "i" } },
      ],
    }).sort({ createdAt: -1 });

    res.json(forms);
  } catch (error) {
    console.error("❌ Error searching forms:", error);
    res.status(500).json({ message: "Failed to search forms" });
  }
});

router.post("/:id/send-to-admin", async (req, res) => {
  const { id } = req.params;
  const { doctorId, timestamp } = req.body;

  try {
    const form = await Form.findById(id);
    if (!form) return res.status(404).json({ message: "Form not found" });

    // Add adminNotifications array if not exist
    form.adminNotifications = form.adminNotifications || [];

    // Push a new notification
    form.adminNotifications.push({ doctorId, timestamp });
    await form.save();

    res.json({ message: "Notification sent to admin" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send notification" });
  }
});
// PUT /api/forms/:id/add-doctor
// router.put("/forms/:id/add-doctor", async (req, res) => {
//   try {
//     const { doctorName } = req.body;
//     const formId = req.params.id;

//     const form = await Form.findById(formId);
//     if (!form) return res.status(404).json({ success: false, message: "Form not found" });

//     if (!form.sentDoctors) form.sentDoctors = [];
//     if (!form.sentDoctors.includes(doctorName)) form.sentDoctors.push(doctorName);

//     await form.save();
//     res.status(200).json({ success: true, sentDoctors: form.sentDoctors });
//   } catch (err) {
//     console.error("❌ Error in /forms/:id/add-doctor:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// PUT /api/forms/:id/add-doctor
// router.put("/:id/add-doctor", async (req, res) => {
//   try {
//     const { doctorName } = req.body;
//     if (!doctorName) return res.status(400).json({ message: "Doctor name required" });

//     const form = await Form.findById(req.params.id);
//     if (!form) return res.status(404).json({ message: "Form not found" });

//     // Add doctor only if not already in sentDoctors
//     if (!form.sentDoctors) form.sentDoctors = [];
//     if (!form.sentDoctors.includes(doctorName)) {
//       form.sentDoctors.push(doctorName);
//       await form.save();
//     }

//     res.json({ success: true, sentDoctors: form.sentDoctors });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// });

// GET /api/forms/:id — fetch single form by ID
router.get("/forms/:id", async (req, res) => {
  try {
    const form = await Form.findById(req.params.id);
    if (!form) return res.status(404).json({ success: false, message: "Form not found" });
    res.json({ success: true, form });
  } catch (error) {
    console.error("❌ Error in GET /forms/:id:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});
// router.put("/:id/assign-doctor", async (req, res) => {
//   try {
//     const { doctorId } = req.body; // We only need doctorId

//     if (!doctorId) {
//       return res.status(400).json({ success: false, message: "Doctor ID required" });
//     }

//     const form = await Form.findById(req.params.id);
//     if (!form) return res.status(404).json({ success: false, message: "Form not found" });

//     // Update the assignment fields
//     form.assignedDoctor = doctorId;
//     form.assignedAt = new Date();
    
//     // Ensure the status is set so the Doctor Panel filters can see it
//     form.status = "Assigned"; 

//     // Add to history array if not already there
//     if (!form.sentDoctors.includes(doctorId)) {
//       form.sentDoctors.push(doctorId);
//     }

//     await form.save();

//     res.json({ success: true, message: "Doctor assigned successfully", form });
//   } catch (err) {
//     console.error("❌ Assign doctor error:", err);
//     res.status(500).json({ success: false, message: "Failed to assign doctor" });
//   }
// });
// // PUT /api/forms/:id/assign-doctor
// // routes/formRoutes.js
// router.put("/:id/assign-doctor", async (req, res) => {
//   try {
//     const { doctorId, doctorName } = req.body;

//     if (!doctorId || !doctorName) {
//       return res.status(400).json({ success: false, message: "Doctor ID and name required" });
//     }

//     const form = await Form.findById(req.params.id);
//     if (!form) return res.status(404).json({ success: false, message: "Form not found" });

//     // Prevent duplicates
//     if (!form.sentDoctors) form.sentDoctors = [];
//     if (!form.sentDoctors.includes(doctorId)) {
//       form.sentDoctors.push(doctorId);
//       form.assignedDoctor = doctorId;
//       form.assignedAt = new Date();
//       await form.save();
//     }

//     res.json({ success: true, message: "Doctor assigned successfully", form });
//   } catch (err) {
//     console.error("❌ Assign doctor error:", err);
//     res.status(500).json({ success: false, message: "Failed to assign doctor" });
//   }
// });

// ✅ SINGLE UNIFIED ASSIGNMENT ROUTE
router.put("/:id/assign-doctor", async (req, res) => {
  try {
    const { doctorId } = req.body;

    if (!doctorId) {
      return res.status(400).json({ success: false, message: "Doctor ID is required" });
    }

    const form = await Form.findById(req.params.id);
    if (!form) {
      return res.status(404).json({ success: false, message: "Form not found" });
    }

    // 1. Update the main assignment field (for the Dashboard fetch)
    form.assignedDoctor = doctorId;
    form.assignedAt = new Date();
    
    // 2. Set the status so the Doctor Panel's filter ("Assigned") works
    form.status = "Assigned";

    // 3. Add to the history array (sentDoctors) if not already there
    // Note: We store the ID as a string here to match your array type [String]
    if (!form.sentDoctors.includes(doctorId.toString())) {
      form.sentDoctors.push(doctorId.toString());
    }

    await form.save();

    res.json({ 
      success: true, 
      message: "Prescription assigned to doctor successfully",
      form 
    });
  } catch (err) {
    console.error("❌ Assignment Error:", err);
    res.status(500).json({ success: false, message: "Server error during assignment" });
  }
});

// ✅ NEW ROUTE: Fetch prescriptions assigned to a specific doctor
router.get("/doctor-assignments/:doctorId", async (req, res) => {
  try {
    const { doctorId } = req.params;

    // 1. Validate if the ID is a valid MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid Doctor ID format" 
      });
    }

    // 2. Explicitly convert the String ID to an ObjectId for the query
    const assignments = await Form.find({ 
      assignedDoctor: new mongoose.Types.ObjectId(doctorId) 
    }).sort({ assignedAt: -1 });

    res.json(assignments);
  } catch (error) {
    // This catches the error and prevents the 500 crash
    console.error("❌ Database Query Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// Mark prescription as opened
// ✅ Change this to include "/forms" so the URL becomes /api/forms/:id/mark-complete
router.put("/forms/:id/mark-complete", async (req, res) => {
  try {
    const { status } = req.body;
    
    // Debug log to see if the request is hitting the server
    console.log("Updating form:", req.params.id, "to status:", status);

    const form = await Form.findByIdAndUpdate(
      req.params.id, 
      { status: status }, 
      { new: true }
    );

    if (!form) return res.status(404).json({ success: false, message: "Form not found" });

    res.json({ success: true, form });
  } catch (err) {
    console.error("Status Update Error:", err);
    res.status(500).json({ success: false });
  }
});

// PUT /api/forms/:id/mark-complete
// PUT /api/forms/:id/mark-complete
// ✅ Change this to include "/forms" so the URL becomes /api/forms/:id/mark-complete
// router.put("/forms/:id/mark-complete", async (req, res) => {
//   try {
//     const { status } = req.body;
    
//     // Debug log to see if the request is hitting the server
//     console.log("Updating form:", req.params.id, "to status:", status);

//     const form = await Form.findByIdAndUpdate(
//       req.params.id, 
//       { status: status }, 
//       { new: true }
//     );

//     if (!form) return res.status(404).json({ success: false, message: "Form not found" });

//     res.json({ success: true, form });
//   } catch (err) {
//     console.error("Status Update Error:", err);
//     res.status(500).json({ success: false });
//   }
// });

// ✅ THE ONLY ROUTE YOU NEED FOR THE DOCTOR PANEL
// URL called from frontend: /api/update-clinical-status/:id
router.put("/update-clinical-status/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    console.log(`📡 Workflow Hit: ID ${id} changing to ${status}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID format" });
    }

    const updatedForm = await Form.findByIdAndUpdate(
      id,
      { $set: { status: status } }, // Explicitly set the status
      { new: true, runValidators: true }
    );

    if (!updatedForm) {
      return res.status(404).json({ success: false, message: "Form not found" });
    }

    res.json({ 
      success: true, 
      message: "Status updated successfully", 
      status: updatedForm.status 
    });
  } catch (err) {
    console.error("❌ Status Update Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ Change this to include "/forms" so the URL becomes /api/forms/:id/mark-complete
router.put("/forms/:id/mark-complete", async (req, res) => {
  try {
    const { status } = req.body;
    
    // Debug log to see if the request is hitting the server
    console.log("Updating form:", req.params.id, "to status:", status);

    const form = await Form.findByIdAndUpdate(
      req.params.id, 
      { status: status }, 
      { new: true }
    );

    if (!form) return res.status(404).json({ success: false, message: "Form not found" });

    res.json({ success: true, form });
  } catch (err) {
    console.error("Status Update Error:", err);
    res.status(500).json({ success: false });
  }
});
// PUT /api/forms/:id/toggle-status
router.put("/forms/:id/toggle-status", async (req, res) => {
  try {
    const { doctorId } = req.body;
    const form = await Form.findById(req.params.id);
    if (!form) return res.status(404).json({ success: false, message: "Form not found" });

    // Toggle status
    form.status = form.status === "Pending" ? "Completed" : "Pending";

    // Optional: track who changed it
    if (!form.openedBy) form.openedBy = [];
    if (!form.openedBy.includes(doctorId)) form.openedBy.push(doctorId);

    await form.save();

    res.json({ success: true, status: form.status });
  } catch (err) {
    console.error("❌ Toggle status error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
