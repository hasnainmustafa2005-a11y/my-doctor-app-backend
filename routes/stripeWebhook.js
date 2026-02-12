import express from "express";
import Stripe from "stripe";
import Booking from "../models/Booking.js";
import Form from "../models/Form.js";
import TimeSlot from "../models/TimeSlot.js";
import Doctor from "../models/Doctor.js";
import { notifyDoctor } from "../server.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * 🔹 Helper: Find an available doctor for given date & time
 */
async function findAvailableDoctor(dateStr, timeStr) {
  const bookingDate = new Date(dateStr);
  const dayOfWeek = bookingDate.toLocaleDateString("en-US", { weekday: "long" });

  const doctors = await Doctor.find({ status: "Active" });

  for (const doc of doctors) {
    let isAvailable = false;

    for (const month of doc.monthlyAvailability) {
      if (
        month.year === bookingDate.getFullYear() &&
        month.month === bookingDate.getMonth() + 1
      ) {
        const day = month.days.find(d =>
          d.date.toISOString().slice(0, 10) === bookingDate.toISOString().slice(0, 10)
        );
        if (day && day.isAvailable) {
          if (timeStr >= day.startTime && timeStr < day.endTime) isAvailable = true;
        }
      }
    }

    if (!isAvailable && doc.availability?.length) {
      const weekly = doc.availability.find(d => d.day === dayOfWeek);
      if (weekly && timeStr >= weekly.startTime && timeStr < weekly.endTime) {
        isAvailable = true;
      }
    }

    if (!isAvailable) continue;

    const existingBooking = await Booking.findOne({
      doctorId: doc._id,
      date: dateStr,
      time: timeStr,
    });

    if (!existingBooking) return doc._id.toString();
  }
  return null;
}

/**
 * CENTRALIZED STRIPE WEBHOOK
 */
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const paymentIntentId = session.payment_intent;
        const metadata = session.metadata || {};

        /* -------------------------------
            🔵 BOOKING PAYMENT
        -------------------------------- */
        if (metadata.type === "BOOKING") {
          const existingBooking = await Booking.findOne({
            stripeSessionId: session.id,
          });

          if (existingBooking) {
            console.log("⚠️ Duplicate BOOKING webhook ignored");
            return res.json({ received: true });
          }

          // 🔒 Decrement slot atomically
          const slot = await TimeSlot.findOneAndUpdate(
            {
              date: metadata.date,
              time: metadata.time,
              remaining: { $gt: 0 },
            },
            { $inc: { remaining: -1 } },
            { new: true }
          );

          if (!slot) {
            console.error("❌ Slot already full");
            return res.status(409).json({ error: "Slot full" });
          }

          // 🔹 Auto assign doctor
          let assignedDoctorId = metadata.doctorId || null;
          if (!assignedDoctorId) {
            assignedDoctorId = await findAvailableDoctor(
              metadata.date,
              metadata.time
            );
          }

          // ✅ CREATE BOOKING
          const bookingData = await Booking.create({
            userId: metadata.userId || null,
            doctorId: assignedDoctorId,
            userName: metadata.userName,
            userEmail: session.customer_email || metadata.userEmail,
            phone: metadata.phone,
            dob: metadata.dob,
            address: metadata.address,
            service: metadata.service,
            date: metadata.date,
            time: metadata.time,
            paymentStatus: "Paid",
            paymentId: paymentIntentId,
            stripeSessionId: session.id,
            status: "Pending",
            assignedAutomatically: !metadata.doctorId && !!assignedDoctorId,
          });

          // 🛠 POPULATE DOCTOR INFO FOR DASHBOARD
          // This ensures the admin sees the name immediately without refreshing
          const fullBooking = await Booking.findById(bookingData._id)
            .populate("doctorId")
            .lean();

          // 🔥 REAL-TIME UPDATE
          const io = req.app.get("io");
          if (io) {
            // Emitting "bookingUpdated" to match your Dashboard's listener
            io.emit("bookingUpdated", fullBooking); 
            // Update slot count for the booking UI
            io.emit("slot-updated", slot);
          }

          if (fullBooking.doctorId) {
            notifyDoctor(fullBooking.doctorId._id.toString(), fullBooking);
          }

          console.log("✅ Booking created and broadcasted");
        }

        /* -------------------------------
            🟢 FORM PAYMENT
        -------------------------------- */
        if (metadata.type === "FORM") {
          const existingForm = await Form.findOne({
            stripeSessionId: session.id,
          });

          if (existingForm) {
            console.log("⚠️ Duplicate FORM webhook ignored");
            return res.json({ received: true });
          }

          await Form.findByIdAndUpdate(metadata.formId, {
            paymentStatus: "paid",
            stripePaymentIntentId: paymentIntentId,
            stripeSessionId: session.id,
          });

          console.log("✅ Form payment confirmed");
        }
      }

      /* ===============================
          🔁 REFUND HANDLING
      ================================ */
      if (event.type === "charge.refunded") {
        const charge = event.data.object;
        const paymentIntentId = charge.payment_intent;

        const booking = await Booking.findOne({ paymentId: paymentIntentId });
        if (booking) {
          booking.paymentStatus = "Refunded";  
          booking.status = "Refunded";

          const slot = await TimeSlot.findOne({
            date: booking.date,
            time: booking.time,
          });
          if (slot) {
            slot.remaining += 1;
            await slot.save();
          }

          booking.doctorId = null;
          booking.assignedAutomatically = false;
          await booking.save();
          
          // Notify dashboard of the refund
          const io = req.app.get("io");
          if (io) io.emit("bookingUpdated", booking);
        }

        await Form.findOneAndUpdate(
          { stripePaymentIntentId: paymentIntentId },
          { paymentStatus: "refunded" }
        );

        console.log("🔁 Refund processed & DB updated");
      }

      res.json({ received: true });
    } catch (err) {
      console.error("❌ Webhook processing error:", err);
      res.status(500).send("Webhook processing failed");
    }
  }
);

export default router;