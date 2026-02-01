import express from "express";
import Blog from "../models/Blog.js";

const router = express.Router();

/* =========================
   CREATE BLOG
========================= */
router.post("/", async (req, res) => {
  try {
    const { title, content, image } = req.body;

    if (!title || !content || !image) {
      return res.status(400).json({ message: "All fields required" });
    }

    const blog = new Blog({
      title,
      content,
      image, // BASE64
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
   GET ALL BLOGS
========================= */
router.get("/", async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.json(blogs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   UPDATE BLOG
========================= */
router.put("/:id", async (req, res) => {
  try {
    const { title, content, image } = req.body;

    const updateData = { title, content };
    if (image) updateData.image = image;

    const blog = await Blog.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });

    if (!blog) return res.status(404).json({ message: "Blog not found" });

    res.json(blog);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   DELETE BLOG
========================= */
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
