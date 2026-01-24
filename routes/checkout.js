import express from "express";
import Stripe from "stripe";
import TimeSlot from "../models/TimeSlot.js";
import Form from "../models/Form.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post("/create-checkout-session", async (req, res) => {
  try {
    const {
      formData,
      service,
      selectedDate,
      selectedTime,
      doctorId,
    } = req.body;

    // 1️⃣ Validate
    if (!formData?.firstName || !formData?.email || !selectedDate || !selectedTime) {
      return res.status(400).json({ message: "Missing required data" });
    }

    // 2️⃣ Check slot availability (READ-ONLY)
    const slot = await TimeSlot.findOne({
      date: selectedDate,
      time: selectedTime,
      isVisible: true,
      remaining: { $gt: 0 },
    });

    if (!slot) {
      return res.status(400).json({ message: "Slot unavailable" });
    }

    // 3️⃣ Stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: formData.email,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: service },
            unit_amount: 5000,
          },
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
        dob: formData.dob,
        address: formData.address,
        service,
        date: selectedDate,
        time: selectedTime,
        doctorId: doctorId || "",
      },
    });

    res.json({ url: session.url });

  } catch (err) {
    console.error("❌ Checkout error:", err);
    res.status(500).json({ message: "Checkout failed" });
  }
});

router.post("/forms/create-checkout-session", async (req, res) => {
  try {
    const { formId, category, subCategory, email } = req.body;

    if (!formId || !email) {
      return res.status(400).json({ message: "Missing required data" });
    }

    const form = await Form.findById(formId);
    if (!form) return res.status(404).json({ message: "Form not found" });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `${category} - ${subCategory}`,
            },
            unit_amount: 5000, // same price for all
          },
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
        service: "Online Prescription",
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("❌ Form checkout error:", err);
    res.status(500).json({ message: "Checkout failed" });
  }
});

export default router;