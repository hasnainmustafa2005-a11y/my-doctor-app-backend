import express from "express";
import Blog from "../models/Blog.js";

const router = express.Router();

/* =========================
   CREATE BLOG (With Category)
========================= */
router.post("/", async (req, res) => {
  try {
    const { title, content, image, category } = req.body;

    if (!title || !content || !image || !category) {
      return res.status(400).json({ message: "All fields including category are required" });
    }

    const blog = new Blog({
      title,
      content,
      image,
      category, // Saved here
      author: "Admin",
    });

    await blog.save();
    res.status(201).json(blog);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   GET ALL BLOGS (With Filtering)
========================= */
router.get("/", async (req, res) => {
  try {
    const { category } = req.query; // Get category from URL query ?category=Mental%20Health
    
    let filter = {};
    if (category) {
      filter.category = category;
    }

    const blogs = await Blog.find(filter).sort({ createdAt: -1 });
    res.json(blogs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   UPDATE BLOG (With Category)
========================= */
router.put("/:id", async (req, res) => {
  try {
    const { title, content, image, category } = req.body;

    const updateData = { title, content, category };
    if (image) updateData.image = image;

    const blog = await Blog.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true, // Ensures category matches the enum
    });

    if (!blog) return res.status(404).json({ message: "Blog not found" });

    res.json(blog);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE remains the same...
router.delete("/:id", async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });
    res.json({ message: "Blog deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;