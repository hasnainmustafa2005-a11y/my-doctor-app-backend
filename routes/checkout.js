import express from "express";
import Stripe from "stripe";
import TimeSlot from "../models/TimeSlot.js";
import Form from "../models/Form.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 1. Updated Appointment Booking Route
router.post("/create-checkout-session", async (req, res) => {
  try {
    const {
      formData,
      service,
      selectedDate,
      selectedTime,
      doctorId,
      priceId, // 👈 Now receiving the ID from Frontend
    } = req.body;

    // Validate essential data
    if (!formData?.email || !selectedDate || !selectedTime || !priceId) {
      return res.status(400).json({ message: "Missing required booking data or Price ID" });
    }

    // Check slot availability
    const slot = await TimeSlot.findOne({
      date: selectedDate,
      time: selectedTime,
      isVisible: true,
      remaining: { $gt: 0 },
    });

    if (!slot) {
      return res.status(400).json({ message: "This slot is no longer available" });
    }

    // Create Stripe Session using the dynamic Price ID
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: formData.email,
      line_items: [
        {
          price: priceId, // 👈 Stripe automatically knows the Price & Name from this ID
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/payment-success`,
      cancel_url: `${process.env.FRONTEND_URL}/payment-cancel`,
      metadata: {
        type: "BOOKING",
        userName: `${formData.firstName} ${formData.lastName}`,
        userEmail: formData.email,
        phone: formData.phone,
        service,
        date: selectedDate,
        time: selectedTime,
        doctorId: doctorId || "",
      },
    });

    res.json({ url: session.url });

  } catch (err) {
    console.error("❌ Checkout error:", err);
    res.status(500).json({ message: "Server error during checkout" });
  }
});

// 2. Updated Prescription Form Route
router.post("/forms/create-checkout-session", async (req, res) => {
  try {
    const { formId, category, subCategory, email, priceId } = req.body; // 👈 Added priceId here too

    if (!formId || !email || !priceId) {
      return res.status(400).json({ message: "Missing form data or Price ID" });
    }

    const form = await Form.findById(formId);
    if (!form) return res.status(404).json({ message: "Form record not found" });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          price: priceId, // 👈 Dynamic Price for different form types
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/payment-success`,
      cancel_url: `${process.env.FRONTEND_URL}/payment-cancel`,
      metadata: {
        type: "FORM",
        formId: form._id.toString(),
        category,
        subCategory,
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("❌ Form checkout error:", err);
    res.status(500).json({ message: "Form checkout failed" });
  }
});

export default router;