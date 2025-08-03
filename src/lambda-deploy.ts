// ts-server/src/lambda-deploy.ts
// AWS Lambda deployment entry point

import serverlessExpress from 'serverless-http';
import app from './app-lambda.js';

// Create Lambda handler
const handler = serverlessExpress(app, {
  binary: false,
  request: (request: any, event: any, context: any) => {
    // Add event and context to request for access in routes
    request.event = event;
    request.context = context;
  },
  response: (response: any, event: any, context: any) => {
    // Add any response modifications if needed
    response.headers = response.headers || {};
    
    // Ensure CORS headers are present
    const origin = event.headers?.origin || event.headers?.Origin;
    const allowedOrigins = [
      "http://localhost:5173",
      "http://localhost:3000", 
      "https://dev.d38b2r7xpw0io.amplifyapp.com",
      "https://main.d38b2r7xpw0io.amplifyapp.com",
      "https://d38b2r7xpw0io.amplifyapp.com",
    ];

    if (origin && allowedOrigins.includes(origin)) {
      response.headers['Access-Control-Allow-Origin'] = origin;
    } else {
      response.headers['Access-Control-Allow-Origin'] = allowedOrigins[0];
    }
    
    response.headers['Access-Control-Allow-Credentials'] = 'true';
    response.headers['Access-Control-Allow-Methods'] = 'GET,HEAD,OPTIONS,POST,PUT,DELETE,PATCH';
    response.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Api-Key, X-Amz-Security-Token, X-Browser, X-Chrome-Version, X-Supports-FedCM, X-Request-Timestamp, X-Browser-Info, X-Client-Version';
  }
});

// Log Lambda startup
console.log("🚀 TypeScript Lambda handler initialized");
console.log("📍 Environment:", process.env.NODE_ENV || "production");
console.log("🌍 Region:", process.env.AWS_REGION || "unknown");

export { handler };