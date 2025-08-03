// ts-server/src/types/environment.d.ts
// Environment variable type definitions

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Node environment
      NODE_ENV: 'development' | 'production' | 'test';
      PORT?: string;
      
      // JWT
      JWT_SECRET: string;
      
      // PostgreSQL
      POSTGRES_USER: string;
      POSTGRES_PASSWORD: string;
      POSTGRES_HOST: string;
      POSTGRES_DB: string;
      POSTGRES_PORT?: string;
      
      // AWS RDS (Production)
      RDS_USERNAME?: string;
      RDS_PASSWORD?: string;
      RDS_HOSTNAME?: string;
      RDS_DB_NAME?: string;
      RDS_PORT?: string;
      
      // AWS
      AWS_REGION?: string;
      AWS_ACCESS_KEY_ID?: string;
      AWS_SECRET_ACCESS_KEY?: string;
      AWS_LAMBDA_FUNCTION_NAME?: string;
      
      // Cloudinary
      CLOUDINARY_CLOUD_NAME: string;
      CLOUDINARY_API_KEY: string;
      CLOUDINARY_API_SECRET: string;
      
      // Razorpay
      RAZORPAY_KEY_ID: string;
      RAZORPAY_SECRET_KEY: string;
      
      // Google OAuth
      GOOGLE_CLIENT_ID: string;
      GOOGLE_CLIENT_SECRET: string;
      
      // Frontend URL (for CORS)
      FRONTEND_URL?: string;
      
      // DynamoDB Local (Development)
      DYNAMODB_LOCAL_ENDPOINT?: string;
    }
  }
}

// Make this file a module
export {};