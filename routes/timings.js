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
// GET /api/timings/public
router.get("/public", async (req, res) => {
  try {
    const timings = await Timing.find();

    // 1. Filter each group individually
    const weekdays = timings.filter(t => ["Monday","Tuesday","Wednesday","Thursday","Friday"].includes(t.day));
    const saturday = timings.find(t => t.day === "Saturday");
    const sunday = timings.find(t => t.day === "Sunday");

    // Helper to format the range
    const formatRange = (t, label) => t ? { label, startTime: t.startTime, endTime: t.endTime } : null;
    
    // Helper for weekdays (takes the first one found to represent the group)
    const formatGroup = (arr, label) => arr.length ? { label, startTime: arr[0].startTime, endTime: arr[0].endTime } : null;

    res.json({
      weekdays: formatGroup(weekdays, "Mon-Fri"),
      saturday: formatRange(saturday, "Saturday"),
      sunday: formatRange(sunday, "Sunday"),
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch public timings", error: err.message });
  }
});

export default router;
