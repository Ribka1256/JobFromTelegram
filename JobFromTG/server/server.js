import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

function loadJobs() {
  try {
    const filePath = path.resolve("jobs.json");
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to read jobs.json:", err);
    return [];
  }
}

app.get("/jobs", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  let jobs = loadJobs();

  if (query) {
    jobs = jobs.filter((job) =>
      job.title?.toLowerCase().includes(query) ||
      job.description?.toLowerCase().includes(query) ||
      job.company_name?.toLowerCase().includes(query) ||
      job.location?.toLowerCase().includes(query)
    );
  }

  res.json(jobs);
});

app.post("/apply", (req, res) => {
  try {
    console.log("Application received:", req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));