import express from "express";
import Timing from "../models/Timing.js";

const router = express.Router();

// Get all timings
router.get("/", async (req, res) => {
  try {
    const timings = await Timing.find();
    res.json(timings);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch timings", error: err.message });
  }
});

// Update a day's timing
router.put("/:id", async (req, res) => {
  try {
    const { startTime, endTime } = req.body;
    const timing = await Timing.findById(req.params.id);
    if (!timing) return res.status(404).json({ message: "Timing not found" });

    timing.startTime = startTime;
    timing.endTime = endTime;
    await timing.save();

    res.json({ success: true, timing });
  } catch (err) {
    res.status(500).json({ message: "Failed to update timing", error: err.message });
  }
});

// POST /api/timings/seed
router.post("/seed", async (req, res) => {
  const days = [
    "Monday","Tuesday","Wednesday",
    "Thursday","Friday","Saturday","Sunday"
  ];

  const exists = await Timing.countDocuments();
  if (exists > 0) {
    return res.json({ message: "Timings already exist" });
  }

  await Timing.insertMany(
    days.map((day) => ({
      day,
      startTime: "18:00",
      endTime: "23:00",
    }))
  );

  res.json({ message: "Timings created" });
});

// GET /api/timings/public
router.get("/public", async (req, res) => {
  try {
    const timings = await Timing.find();

    const weekdays = timings.filter(t => ["Monday","Tuesday","Wednesday","Thursday","Friday"].includes(t.day));
    const weekend = timings.filter(t => ["Saturday","Sunday"].includes(t.day));

    const format = (arr, label) => arr.length ? { label, startTime: arr[0].startTime, endTime: arr[0].endTime } : null;

    res.json({
      weekdays: format(weekdays, "Mon-Fri"),
      weekend: format(weekend, "Sat-Sun"),
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch public timings", error: err.message });
  }
});

export default router;
