// ts-server/src/types/index.ts
// Central export for all types

export * from './models.js';
export * from './api.js';

// Re-export common types for convenience
export type { Request, Response, NextFunction } from 'express';
export type { RequestHandler } from 'express';

// Custom error type
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Async handler wrapper type
export type AsyncHandler<T = any> = (
  req: Express.Request,
  res: Express.Response,
  next: Express.NextFunction
) => Promise<T>;

// Database query result types
export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

// DynamoDB operation types
export interface DynamoDBKey {
  PK: string;
  SK: string;
}

export interface DynamoDBQueryParams {
  TableName: string;
  KeyConditionExpression?: string;
  ExpressionAttributeNames?: Record<string, string>;
  ExpressionAttributeValues?: Record<string, any>;
  FilterExpression?: string;
  Limit?: number;
  ExclusiveStartKey?: Record<string, any>;
  ScanIndexForward?: boolean;
  IndexName?: string;
}

// Common enums
export enum UserRole {
  LEARNER = 'Learner',
  INSTRUCTOR = 'Instructor'
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded'
}

export enum LessonStatus {
  COMPLETED = 'completed',
  IN_PROGRESS = 'in_progress',
  FAILED = 'failed'
}

export enum ExerciseType {
  MULTIPLE_CHOICE = 'multiple_choice',
  FILL_BLANK = 'fill_blank',
  TRANSLATION = 'translation'
}

// Utility types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncFunction<T = void> = () => Promise<T>;