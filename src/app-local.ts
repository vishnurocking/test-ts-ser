// ts-server/src/app-local.ts
// LOCAL DEVELOPMENT VERSION - TypeScript with Chrome compatibility

import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import userRoute from './routes/user.route.js';
import courseRoute from './routes/course.route.js';
import purchaseRoute from './routes/purchaseCourse.route.js';
import courseProgressRoute from './routes/courseProgress.route.js';
import freeLessonsRoute from './routes/freeLessons.route.js';
import userProgressRoute from './routes/userProgress.route.js';
import { testAllConnections } from './config/databaseClients.js';
import { ApiResponse } from './types/index.js';

// Load environment variables for local development
dotenv.config();

const app = express();

console.log("🌍 Running in LOCAL DEVELOPMENT mode");

// CORS Configuration for Local Development
const corsOptions: cors.CorsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "https://dev.d38b2r7xpw0io.amplifyapp.com",
  ],
  credentials: true, // Allow cookies and authorization headers
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "X-Api-Key",
    "X-Amz-Security-Token",
    // Chrome-specific debugging headers
    "X-Browser",
    "X-Chrome-Version",
    "X-Supports-FedCM",
    "X-Request-Timestamp",
    // Additional browser headers
    "X-Browser-Info",
    "X-Client-Version",
  ],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
console.log("✅ CORS enabled for local development with Chrome headers");

// Global Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request Logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  const browser = req.headers["x-browser"] || "unknown";
  console.log(
    `[${timestamp}] ${req.method} ${req.path} - Browser: ${browser} - Origin: ${
      req.headers.origin || "undefined"
    }`
  );
  next();
});

// Health Check Route
app.get("/health", (req: Request, res: Response<ApiResponse>) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    data: {
      status: "OK",
      timestamp: new Date().toISOString(),
      environment: "local-development",
      corsMode: "Express CORS with Chrome headers",
      server: "Local Express Server",
      nodeVersion: process.version,
      platform: process.platform,
    },
  });
});

// API Routes
app.use("/api/v1/user", userRoute);
app.use("/api/v1/course", courseRoute);
app.use("/api/v1/purchase", purchaseRoute);
app.use("/api/v1/progress", courseProgressRoute);
app.use("/api/v1/freelessons", freeLessonsRoute);
app.use("/api/v1/userprogress", userProgressRoute);

// 404 Handler
app.use("*", (req: Request, res: Response<ApiResponse>) => {
  const originalPath = req.originalUrl;
  console.log(`❌ 404 - Route not found for path: ${originalPath}`);
  res.status(404).json({
    success: false,
    message: "Route not found",
    error: `Path '${originalPath}' not found`,
    data: {
      availableRoutes: [
        "/health",
        "/api/v1/user",
        "/api/v1/course",
        "/api/v1/purchase",
        "/api/v1/progress",
        "/api/v1/freelessons",
        "/api/v1/userprogress",
      ],
    },
  });
});

// Global Error Handler
app.use((err: Error, req: Request, res: Response<ApiResponse>, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] Global Error Handler:`, err);

  // Don't expose stack trace in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: err.message,
    ...(isDevelopment && { stack: err.stack }),
    data: {
      timestamp,
      environment: "local-development",
    },
  });
});

export default app;