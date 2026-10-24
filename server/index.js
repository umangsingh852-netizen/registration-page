
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
  fullName: z.string().trim().min(2).max(100),
  studentNumber: z.string().trim().min(1).max(50)
    .refine((value) => !value.startsWith("26"), {
      message: "First-year students are not eligible.",
    }),
  universityRollNo: z.string().trim()
    .regex(/^(23|24|25)\d{11}$/, "Invalid university roll number.")
    .refine((value) => value.includes("027"), {
      message: "University roll number must contain college code 027.",
    }),
  branch: z.enum([
    "CSE",
    "CSE (AI & ML)",
    "IT",
    "ECE",
    "EN",
    "ME",
    "CS (Data Science)",
    "CE",
  ]),
  gender: z.enum(["Male", "Female", "Other", "Prefer not to say"]),
  residence: z.enum(["Dayscholar", "Hosteler"]),
  currentYear: z.enum(["2", "3", "4"]),
  section: z.string().trim().max(30).optional().default(""),
  collegeEmail: z.string().trim().email().max(254),
  whatsapp: z.string().trim().regex(/^\+?[0-9\s()-]{8,20}$/),
  attendanceConfirmed: z.literal(true),
});

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

async function verifyTurnstileToken(token) {
  const secret = process.env.TURNSTILE_SECRET;

  if (!secret || typeof token !== "string" || !token || token.length > 2048) {
    return false;
  }

  const allowedHostnames = (process.env.TURNSTILE_HOSTNAMES || "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);

  if (allowedHostnames.length === 0) {
    console.error("TURNSTILE_HOSTNAMES is not configured");
    return false;
  }

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          secret,
          response: token,
        }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      console.error("Turnstile verification request failed");
      return false;
    }

    const result = await response.json();

    return (
      result.success === true &&
      typeof result.hostname === "string" &&
      allowedHostnames.includes(result.hostname.toLowerCase())
    );
  } catch (error) {
    console.error("Turnstile verification unavailable:", error.message);
    return false;
  }
}

app.post(
  "/api/registrations",
  registrationLimiter,
  async (req, res) => {
    try {
      const { turnstileToken } = req.body ?? {};

      const captchaValid = await verifyTurnstileToken(turnstileToken);

      if (!captchaValid) {
        return res.status(403).json({
          error: "CAPTCHA verification failed. Please try again.",
        });
      }

      const parsed = registrationSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          error: "Please check the registration details.",
        });
      }

      const {
        fullName,
        studentNumber,
        universityRollNo,
        branch,
        gender,
        residence,
        currentYear,
        section,
        collegeEmail,
        whatsapp,
        attendanceConfirmed,
      } = parsed.data;

      const result = await pool.query(
        `INSERT INTO hour_of_code_registrations (
          full_name,
          student_number,
          university_roll_no,
          branch,
          gender,
          residence,
          current_year,
          section,
          college_email,
          whatsapp,
          attendance_confirmed
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT DO NOTHING
        RETURNING id`,
        [
          fullName,
          studentNumber,
          universityRollNo,
          branch,
          gender,
          residence,
          Number(currentYear),
          section,
          collegeEmail.toLowerCase(),
          whatsapp,
          attendanceConfirmed,
        ]
      );

      if (result.rowCount === 0) {
        return res.status(409).json({
          error: "This student number, roll number, or email may already be registered.",
        });
      }

      return res.status(201).json({
        message: "Registration successful.",
        registrationId: result.rows[0].id,
      });
    } catch (error) {
      console.error("Registration failed:", error.message);

      return res.status(500).json({
        error: "Registration could not be completed. Please try again.",
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
