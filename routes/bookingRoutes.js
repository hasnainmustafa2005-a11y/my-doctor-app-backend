import express from "express";
import Booking from "../models/Booking.js";
import Doctor from "../models/Doctor.js";
import TimeSlot from "../models/TimeSlot.js";

import { notifyDoctor } from "../server.js";

const router = express.Router();

/**
 * 🧾 CREATE NEW BOOKING
 * - Automatically assigns doctor based on availability if doctorId not provided
 */

// Helper to convert "HH:MM" → minutes
const timeToMinutes = (t) => {
  if (!t) return NaN;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/* 🧾 CREATE NEW BOOKING */
// routes/booking.js

router.post("/book", async (req, res) => {
  try {
    const {
      userName,
      userEmail,
      phone,
      dob,
      service,
      time,
      date,
      doctorId,
      formData,
      paymentStatus,
      paymentId,
      // ✅ Address fields
      line1,
      city = "",
      county = "",
      eircode = "",
    } = req.body;

    if (!userName || !userEmail || !phone || !dob || !service || !time || !date || !line1) {
      return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    // ✅ Step 1: Check TimeSlot availability
    const slot = await TimeSlot.findOne({ time, date });
    if (!slot || slot.remaining <= 0 || !slot.isVisible) {
      return res.status(400).json({ success: false, message: "Slot full or unavailable." });
    }

    let assignedDoctor = null;

    // ✅ Step 2: Assign doctor (manual or automatic)
    if (doctorId) {
      assignedDoctor = await Doctor.findById(doctorId);
    } else {
      const activeDoctors = await Doctor.find({ status: "Active" });
      const dayOfWeek = new Date(`${date}T00:00:00`).toLocaleString("en-US", { weekday: "long" });
      const requestedMinutes = timeToMinutes(time);

      for (const doc of activeDoctors) {
        const availability = doc.availability || [];
        const isAvailable = availability.some((slot) => {
          if (slot.day !== dayOfWeek) return false;
          const start = timeToMinutes(slot.startTime);
          const end = timeToMinutes(slot.endTime);
          return requestedMinutes >= start && requestedMinutes <= end;
        });

        if (!isAvailable) continue;

        const existingBookings = await Booking.countDocuments({
          doctorId: doc._id,
          date,
          time,
          status: { $ne: "Canceled" },
        });

        if (existingBookings < slot.capacity) {
          assignedDoctor = doc;
          break;
        }
      }
    }

    // ✅ Step 3: Create booking with address
    const newBooking = new Booking({
      userName,
      userEmail,
      phone,
      dob,
      service,
      time,
      date,
      doctorId: assignedDoctor ? assignedDoctor._id : undefined,
      formData,
      paymentStatus,
      paymentId,
      status: "Pending",
      assignedAutomatically: !!assignedDoctor,
      manuallyAssigned: !!doctorId,
      address: { line1, city, county, eircode }, // ✅ added address
    });

    const savedBooking = await newBooking.save();

    // ✅ Step 4: Decrement slot remaining
    slot.remaining -= 1;
    await slot.save();

    // ✅ Step 5: Emit socket
    const io = req.app.get("io");
    io.emit("slot-updated", slot);

    // ✅ Step 6: Response
    const responseDoctor = assignedDoctor
      ? { _id: assignedDoctor._id, name: assignedDoctor.name, email: assignedDoctor.email }
      : { _id: null, name: "Unassigned", email: null };

    res.status(201).json({
      success: true,
      message: assignedDoctor
        ? `Booking assigned to ${assignedDoctor.name} and visible to admin.`
        : "No doctor available — booking saved for admin review.",
      booking: {
        ...savedBooking.toObject(),
        assignedDoctor: responseDoctor,
        remainingSlot: slot.remaining,
      },
    });
  } catch (error) {
    console.error("❌ Error creating booking:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while creating booking.",
      error: error.message,
    });
  }
});



/**
 * 📋 GET ALL BOOKINGS (Admin)
 */
router.get("/all", async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("doctorId", "name email") // 👈 brings doctor name & email
      .sort({ createdAt: -1 });

    const formatted = bookings.map((b) => ({
      ...b.toObject(),
      assignedDoctor: b.doctorId
        ? { name: b.doctorId.name, email: b.doctorId.email }
        : null,
    }));

    res.status(200).json({ success: true, bookings: formatted });
  } catch (err) {
    console.error("❌ Error fetching bookings:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Assign doctor manually
router.put("/assign/:id", async (req, res) => {
  try {
    const { doctorId } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });

    if (!doctorId) {
      // Unassign
      booking.doctorId = undefined;
      booking.manuallyAssigned = false;
      await booking.save();
      return res.json({ success: true, message: "Doctor unassigned.", booking });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found." });

    booking.doctorId = doctor._id;
    booking.status = "Pending";
    booking.manuallyAssigned = true;
    await booking.save();

    // Optional: notify doctor
    if (typeof notifyDoctor === "function") {
      try {
        notifyDoctor(doctor._id, booking);
      } catch (e) {
        console.warn("⚠️ Notification failed:", e.message);
      }
    }

    res.json({
      success: true,
      message: "Doctor assigned successfully.",
      booking: {
        ...booking.toObject(),
        assignedDoctor: { _id: doctor._id, name: doctor.name, email: doctor.email },
      },
    });
  } catch (err) {
    console.error("❌ Error assigning doctor:", err);
    res.status(500).json({ success: false, message: "Server error while assigning doctor." });
  }
});

router.put("/assign-booking/:bookingId", async (req, res) => {
  try {
    const { doctorId } = req.body;
    if (!doctorId) return res.status(400).json({ success: false, message: "Doctor ID required." });

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found." });

    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });

    booking.doctorId = doctor._id;
    booking.assignedAutomatically = false;
    await booking.save();

    try {
      notifyDoctor(doctor._id, booking);
    } catch (err) {
      console.warn("⚠️ Could not notify doctor:", err.message);
    }

    res.json({ success: true, message: "Doctor manually assigned.", booking });
  } catch (error) {
    console.error("❌ Error assigning doctor:", error);
    res.status(500).json({ success: false, message: "Server error assigning doctor." });
  }
});
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["Pending", "Refunded", "Completed", "Cancelled"];
    if (!status || !validStatuses.includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status value." });
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      id,
      {
        $set: {
          status,
          completedAt: status === "Completed" ? new Date() : null
        }
      },
      { new: true } // return updated doc
    );

    if (!updatedBooking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found." });
    }

    // ✅ Emit socket event
    const io = req.app.get("io");
    io.emit("bookingStatusUpdated", updatedBooking);

    res.json({
      success: true,
      message: "Status updated successfully",
      booking: updatedBooking
    });

  } catch (err) {
    console.error("❌ Error updating booking status:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});


/**
 * 👨‍⚕️ GET BOOKINGS BY DOCTOR ID
 */
router.get("/doctor/:doctorId", async (req, res) => {
  try {
    const bookings = await Booking.find({ doctorId: req.params.doctorId }).sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (error) {
    console.error("Error fetching doctor bookings:", error);
    res.status(500).json({ success: false, message: "Error fetching doctor bookings" });
  }
});
/**
 * 👤 GET USER BOOKINGS BY EMAIL
 */
router.get("/user/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const bookings = await Booking.find({ userEmail: email }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, bookings });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error fetching user bookings", error });
  }
});

/**
 * 🟩 UPDATE BOOKING STATUS
 */
router.put("/update/:id", async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    booking.status = status;
    if (status === "Pending") booking.completedAt = null;

    const updatedBooking = await booking.save();

    // ✅ Emit socket event to doctor & admin dashboards
    const io = req.app.get("io");
    io.emit("bookingStatusUpdated", updatedBooking);

    res.json({ success: true, message: "Status updated", booking: updatedBooking });
  } catch (error) {
    console.error("❌ Error updating booking:", error);
    res.status(500).json({ success: false, message: "Error updating booking", error });
  }
});


/**
 * 🔎 FILTER BOOKINGS BY SERVICE OR DATE
 */
router.get("/filter", async (req, res) => {
  try {
    const { service, date } = req.query;
    const filter = {};
    if (service) filter.service = service;
    if (date) filter.date = date;

    const bookings = await Booking.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error filtering bookings", error });
  }
});

export default router;
