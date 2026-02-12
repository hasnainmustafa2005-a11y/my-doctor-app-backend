import express from "express";
import Stripe from "stripe";
import TimeSlot from "../models/TimeSlot.js";
import Form from "../models/Form.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * 🔹 1. Appointment Booking Checkout
 * This route handles the initial Stripe session creation for medical appointments.
 */
router.post("/create-checkout-session", async (req, res) => {
  try {
    const {
      formData,
      service,
      selectedDate,
      selectedTime,
      doctorId,
      priceId,
    } = req.body;

    // 1. Validation - Ensure all required fields for the Booking model are present
    if (!formData?.email || !selectedDate || !selectedTime || !priceId) {
      return res.status(400).json({ message: "Missing required booking data or Price ID" });
    }

    // 2. Check slot availability before even opening Stripe
    const slot = await TimeSlot.findOne({
      date: selectedDate,
      time: selectedTime,
      isVisible: true,
      remaining: { $gt: 0 },
    });

    if (!slot) {
      return res.status(400).json({ message: "This slot is no longer available" });
    }

    // 3. Create Stripe Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: formData.email,
      line_items: [
        {
          price: priceId, // Uses the dynamic price passed from the frontend
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/payment-success`,
      cancel_url: `${process.env.FRONTEND_URL}/payment-cancel`,
      
      // 4. METADATA: This is what the Webhook uses to build the Booking in MongoDB
      metadata: {
        type: "BOOKING",
        userName: `${formData.firstName} ${formData.lastName}`,
        userEmail: formData.email,
        phone: formData.phone,
        dob: formData.dob || "", 
        // Mapping address fields to a single string to match your Booking model
        address: formData.address || `${formData.line1 || ""}, ${formData.city || ""}`.trim() || "No address provided",
        service: service,
        date: selectedDate,
        time: selectedTime,
        doctorId: doctorId || "", // If empty, the webhook will auto-assign a doctor
        userId: formData.userId || "", // Useful if you have registered users
      },
    });

    // Send the Stripe URL back to the frontend for redirection
    res.json({ url: session.url });

  } catch (err) {
    console.error("❌ Checkout error:", err);
    res.status(500).json({ message: "Server error during checkout" });
  }
});

/**
 * 🔹 2. Prescription / General Form Checkout
 * This route handles payments for specific form submissions.
 */
router.post("/forms/create-checkout-session", async (req, res) => {
  try {
    const { formId, category, subCategory, email, priceId } = req.body;

    if (!formId || !email || !priceId) {
      return res.status(400).json({ message: "Missing form data or Price ID" });
    }

    // Verify the form exists in our DB
    const form = await Form.findById(formId);
    if (!form) return res.status(404).json({ message: "Form record not found" });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/payment-success`,
      cancel_url: `${process.env.FRONTEND_URL}/payment-cancel`,
      metadata: {
        type: "FORM",
        formId: form._id.toString(),
        category: category || "",
        subCategory: subCategory || "",
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("❌ Form checkout error:", err);
    res.status(500).json({ message: "Form checkout failed" });
  }
});

export default router;