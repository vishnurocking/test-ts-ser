// ts-server/src/config/databaseClients.ts
// Hybrid database configuration - PostgreSQL + DynamoDB

import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, TranslateConfig } from "@aws-sdk/lib-dynamodb";
import pg from "pg";
import dotenv from "dotenv";

const { Pool } = pg;

// Load environment variables
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  dotenv.config();
}

const awsRegion = process.env.AWS_REGION || "ap-south-1";
const isLocal = !process.env.AWS_LAMBDA_FUNCTION_NAME;

// PostgreSQL Client Configuration
let pgPool: pg.Pool;

if (isLocal) {
  console.log("🐘 Using LOCAL PostgreSQL");
  pgPool = new Pool({
    user: process.env.POSTGRES_USER || "postgres",
    host: process.env.POSTGRES_HOST || "localhost",
    database: process.env.POSTGRES_DB || "lms_db",
    password: process.env.POSTGRES_PASSWORD || "admin",
    port: parseInt(process.env.POSTGRES_PORT || "5432"),
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
} else {
  console.log("☁️ Using AWS RDS PostgreSQL");
  pgPool = new Pool({
    user: process.env.RDS_USERNAME,
    host: process.env.RDS_HOSTNAME,
    database: process.env.RDS_DB_NAME,
    password: process.env.RDS_PASSWORD,
    port: parseInt(process.env.RDS_PORT || "5432"),
    ssl: {
      rejectUnauthorized: false,
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}

// DynamoDB Client Configuration
let ddbClient: DynamoDBClient;

if (isLocal) {
  console.log("🏠 Using LOCAL DynamoDB");
  ddbClient = new DynamoDBClient({
    region: awsRegion,
    endpoint: process.env.DYNAMODB_LOCAL_ENDPOINT || "http://localhost:8000",
    credentials: {
      accessKeyId: "fakeMyKeyId",
      secretAccessKey: "fakeSecretAccessKey",
    },
  });
} else {
  console.log("☁️ Using AWS DynamoDB");
  ddbClient = new DynamoDBClient({
    region: awsRegion,
  });
}

const marshallOptions = {
  convertEmptyValues: false,
  removeUndefinedValues: true,
  convertClassInstanceToMap: false,
};

const unmarshallOptions = {
  wrapNumbers: false,
};

const translateConfig: TranslateConfig = { marshallOptions, unmarshallOptions };

export const ddbDocClient = DynamoDBDocumentClient.from(
  ddbClient,
  translateConfig
);

export { pgPool, isLocal };

// Table name constants (DynamoDB only)
export const TABLE_NAMES = {
  LMS: "LMS",
  FREE_LESSONS: "FreeLessons",
  USER_PROGRESS: "UserProgress",
} as const;

// Connection test functions
export const testPostgreSQLConnection = async (): Promise<boolean> => {
  try {
    const client = await pgPool.connect();
    const result = await client.query<{ current_time: Date }>("SELECT NOW() as current_time");
    client.release();
    console.log(
      `PostgreSQL connection successful (${isLocal ? "LOCAL" : "AWS RDS"})`
    );
    return true;
  } catch (error) {
    console.error("PostgreSQL connection failed:", error instanceof Error ? error.message : error);
    return false;
  }
};

export const testDynamoDBConnection = async (): Promise<boolean> => {
  try {
    const command = new ListTablesCommand({});
    const response = await ddbClient.send(command);
    console.log(
      `DynamoDB connection successful (${isLocal ? "LOCAL" : "AWS"}). Tables:`,
      response.TableNames
    );
    return true;
  } catch (error) {
    console.error("DynamoDB connection failed:", error instanceof Error ? error.message : error);
    return false;
  }
};

export const testAllConnections = async (): Promise<boolean> => {
  console.log("🔄 Testing all database connections...\n");

  const pgTest = await testPostgreSQLConnection();
  const ddbTest = await testDynamoDBConnection();

  return pgTest && ddbTest;
};

// Type-safe query helper for PostgreSQL
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const client = await pgPool.connect();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}

// Export types for use in other modules
export type { Pool, PoolClient, QueryResult } from 'pg';
export type DynamoDBTableName = typeof TABLE_NAMES[keyof typeof TABLE_NAMES];