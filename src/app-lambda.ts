// ts-server/src/app-lambda.ts
// LAMBDA DEPLOYMENT VERSION - TypeScript with Chrome compatibility

import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import userRoute from './routes/user.route.js';
import courseRoute from './routes/course.route.js';
import purchaseRoute from './routes/purchaseCourse.route.js';
import courseProgressRoute from './routes/courseProgress.route.js';
import freeLessonsRoute from './routes/freeLessons.route.js';
import userProgressRoute from './routes/userProgress.route.js';
import { ApiResponse } from './types/index.js';

const app = express();

console.log("🌍 Running in AWS LAMBDA mode");

// CORS Middleware for Lambda - Updated with Chrome headers
app.use((req: Request, res: Response, next: NextFunction) => {
  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://dev.d38b2r7xpw0io.amplifyapp.com",
    "https://main.d38b2r7xpw0io.amplifyapp.com",
    "https://d38b2r7xpw0io.amplifyapp.com",
  ];

  const origin = req.headers.origin;

  // Set specific origin (not *) to allow credentials
  if (origin && allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
    // For server-to-server requests without origin
    res.header("Access-Control-Allow-Origin", allowedOrigins[0]);
  } else {
    // Fallback to first allowed origin
    res.header("Access-Control-Allow-Origin", allowedOrigins[0]);
  }

  res.header(
    "Access-Control-Allow-Methods",
    "GET,HEAD,OPTIONS,POST,PUT,DELETE,PATCH"
  );

  // Updated to include Chrome-specific headers
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Api-Key, X-Amz-Security-Token, X-Browser, X-Chrome-Version, X-Supports-FedCM, X-Request-Timestamp, X-Browser-Info, X-Client-Version"
  );

  res.header("Access-Control-Allow-Credentials", "true");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    console.log(`✅ CORS Preflight handled for ${req.path} from ${origin}`);
    return res.status(200).end();
  }

  next();
});

console.log("✅ Lambda CORS with Chrome headers enabled");

// Global Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request Logging for Lambda
app.use((req: Request, res: Response, next: NextFunction) => {
  const browser = req.headers["x-browser"] || "unknown";
  const timestamp = req.headers["x-request-timestamp"] || new Date().toISOString();

  console.log(
    `🌐 Lambda: ${req.method} ${req.path} - Browser: ${browser} - Origin: ${
      req.headers.origin || "undefined"
    } - Time: ${timestamp}`
  );
  next();
});

// Health Check Route
app.get("/health", (req: Request, res: Response<ApiResponse>) => {
  const browser = req.headers["x-browser"] || "unknown";
  const chromeVersion = req.headers["x-chrome-version"] || "unknown";

  res.status(200).json({
    success: true,
    message: "Server is running",
    data: {
      status: "OK",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "production",
      corsMode: "Lambda Specific Origins + Credentials + Chrome Headers",
      server: "AWS Lambda",
      region: process.env.AWS_REGION || "unknown",
      origin: req.headers.origin || "none",
      browser: browser,
      chromeVersion: chromeVersion,
      supportsFedCM: req.headers["x-supports-fedcm"] === "true",
      nodeVersion: process.version,
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

// 404 Handler with CORS
app.use("*", (req: Request, res: Response<ApiResponse>) => {
  const originalPath = (req as any).event?.path || req.originalUrl;
  console.log(`❌ 404 - Route not found for path: ${originalPath}`);

  res.status(404).json({
    success: false,
    message: "Route not found",
    error: `Path '${originalPath}' not found`,
    data: {
      environment: "aws-lambda",
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

// Global Error Handler with CORS
app.use((err: Error, req: Request, res: Response<ApiResponse>, next: NextFunction) => {
  console.error("Lambda Error Handler:", err);

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === "development";

  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: isDevelopment ? err.message : "Something went wrong",
    ...(isDevelopment && { stack: err.stack }),
    data: {
      timestamp: new Date().toISOString(),
      environment: "aws-lambda",
    },
  });
});

export default app;