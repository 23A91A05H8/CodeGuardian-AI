import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import axios from "axios";
import mongoose from "mongoose";
import { config } from "./src/config/env";
import { connectDatabase } from "./src/config/database";
import authRoutes from "./src/routes/authRoutes";
import analysisRoutes from "./src/routes/analysisRoutes";
import { errorHandler, notFoundHandler } from "./src/middleware/errorHandler";

export const app = express();

// Security HTTP headers
app.use(helmet());

// CORS configuration supporting single origin, list of origins, or localhost dev
const allowedOrigins = config.CLIENT_URL.split(",").map((s) => s.trim());
app.use(
  cors({
   origin: (origin, callback) => {
  if (!origin) return callback(null, true);

  if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  return callback(new Error("Not allowed by CORS"));
},
    credentials: true,
  })
);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

if (config.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// Health check endpoint verifying DB and AI service connectivity
app.get("/api/health", async (_req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  let aiServiceStatus = "unknown";
  let watsonxConfigured = false;

  try {
    const aiHealth = await axios.get(`${config.AI_SERVICE_URL}/health`, { timeout: 3000 });
    aiServiceStatus = aiHealth.data?.status || "reachable";
    watsonxConfigured = !!aiHealth.data?.watsonx_configured;
  } catch {
    aiServiceStatus = "unreachable";
  }

  const isHealthy = mongoStatus === "connected" && aiServiceStatus !== "unreachable";

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    services: {
      backend: "healthy",
      database: mongoStatus,
      aiService: aiServiceStatus,
      watsonxAI: watsonxConfigured ? "configured" : "demo_mock_mode",
    },
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api", analysisRoutes);

// 404 & Centralized Error Handlers
app.use("/api/*", notFoundHandler);
app.use(errorHandler);

export const startServer = async () => {
  await connectDatabase();
  return app.listen(config.PORT, () => {
    console.log(`🚀 CodeGuardian AI backend running on port ${config.PORT} [${config.NODE_ENV}]`);
  });
};

if (require.main === module) {
  startServer();
}
