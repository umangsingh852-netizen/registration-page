import express from 'express';
import helmet from 'helmet';
import rateLimit from "express-rate-limit";
import cors from "cors";
import { configDotenv } from 'dotenv';

const app = express();
const PORT = process.env.PORT || 3212;

app.use(helmet());

app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173"
}));

app.use(express.json({ limit:"10 kb" }));


app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  validate: {
    trustProxy: false
  }
}));


app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        message: "Registration page API is working"
    });
});

app.listen(PORT, () => {
    console.log(`API running at PORT: ${PORT}`)
});