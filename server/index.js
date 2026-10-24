
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { pool } from "./db.js";
import { readFile } from "node:fs/promises";

const app = express();
const PORT = Number(process.env.PORT) || 3212;

app.use(helmet());

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173"
}));

app.use(express.json({ limit: "10kb" }));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false
}));

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

const registrationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  studentId: z.string().trim().min(3).max(50),
  branch: z.string().trim().min(2).max(100),
  year: z.coerce.number().int().min(1).max(5)
}).strict();

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({
      status: "ok",
      database: "connected"
    });
  } catch {
    res.status(503).json({
      status: "error",
      message: "Service temporarily unavailable"
    });
  }
});

app.post(
  "/api/registrations",
  registrationLimiter,
  async (req, res) => {
    const parsed = registrationSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Please check the registration details."
      });
    }

    const { name, studentId, branch, year } = parsed.data;
    const email = parsed.data.email.toLowerCase();

    try {
      const result = await pool.query(
        `INSERT INTO registrations
          (name, email, student_id, branch, year)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [name, email, studentId, branch, year]
      );

      if (result.rowCount === 0) {
        return res.status(409).json({
          error: "This email or student ID may already be registered."
        });
      }

      return res.status(201).json({
        message: "Registration successful.",
        registrationId: result.rows[0].id
      });
    } catch (error) {
      console.error("Registration failed:", error.message);

      return res.status(500).json({
        error: "Registration could not be completed. Please try again."
      });
    }
  }
);

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON request." });
  }

  console.error("Unhandled request error:", err.message);
  return res.status(500).json({ error: "Internal server error." });
});

async function start() {
  // Create the table for this initial prototype.
  // Use versioned database migrations for ongoing production changes.
  const schema = await readFile(
    new URL("./schema.sql", import.meta.url),
    "utf8"
  );

  await pool.query(schema);
  await pool.query("SELECT 1");

  app.listen(PORT, () => {
    console.log(`API running at PORT: ${PORT}`);
    console.log("Database connected; registration API ready.");
  });
}

start().catch((error) => {
  console.error("Startup failed:", error.message);
  process.exit(1);
});
