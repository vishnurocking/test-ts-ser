# LMS Backend - TypeScript

TypeScript version of the LMS (Learning Management System) backend with dual deployment support for local development and AWS Lambda.

## Features

- **Dual Architecture**: Local Express server + AWS Lambda deployment
- **Hybrid Database**: PostgreSQL (users/purchases) + DynamoDB (courses/lessons/progress)
- **Type Safety**: Full TypeScript implementation with strict type checking
- **Authentication**: JWT-based auth with Google OAuth support
- **File Uploads**: Cloudinary integration for images and videos
- **Payment**: Razorpay integration for course purchases
- **CORS**: Chrome FedCM compatibility with enhanced browser support

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.3+
- **Framework**: Express.js
- **Databases**: PostgreSQL + DynamoDB
- **File Storage**: Cloudinary
- **Payment**: Razorpay
- **Deployment**: AWS Lambda + SAM

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy the environment template:

```bash
cp .env.example .env
```

Fill in the required environment variables.

### 3. Database Setup

Start local databases:

```bash
# PostgreSQL (via Docker or local installation)
# DynamoDB Local
cd C:\aws-tools\dynamodb_local\
java "-Djava.library.path=./DynamoDBLocal_lib" -jar DynamoDBLocal.jar -sharedDb
```

### 4. Development Server

```bash
# TypeScript watch mode
npm run dev

# Or compile and run
npm run build
npm start
```

Server will start at `http://localhost:3000`

## Scripts

- `npm run dev` - Start development server with watch mode
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Run compiled JavaScript (local)
- `npm run typecheck` - Type checking without compilation
- `npm run clean` - Remove compiled files

## API Endpoints

### Authentication
- `POST /api/v1/user/register` - User registration
- `POST /api/v1/user/login` - User login
- `POST /api/v1/user/google-login` - Google OAuth login
- `GET /api/v1/user/logout` - User logout
- `GET /api/v1/user/profile` - Get user profile
- `PUT /api/v1/user/profile/update` - Update profile

### Courses
- `GET /api/v1/course/published` - Get published courses
- `GET /api/v1/course/:courseId` - Get course details
- `POST /api/v1/course` - Create course (instructor)
- `PUT /api/v1/course/:courseId/edit` - Edit course (instructor)
- `GET /api/v1/course/my-courses` - Get instructor's courses

### Purchases
- `POST /api/v1/purchase/create-order` - Create Razorpay order
- `POST /api/v1/purchase/verify-payment` - Verify payment
- `GET /api/v1/purchase/my-courses` - Get purchased courses
- `GET /api/v1/purchase/check/:courseId` - Check purchase status

### Progress Tracking
- `GET /api/v1/progress/:courseId` - Get course progress
- `PUT /api/v1/progress/:courseId/lecture/:lectureId` - Update lecture progress
- `GET /api/v1/progress` - Get all user progress

### Language Learning
- `GET /api/v1/freelessons/active` - Get active lessons
- `GET /api/v1/freelessons/unit/:unitId` - Get lessons by unit
- `GET /api/v1/freelessons/lesson/:lessonId` - Get specific lesson

### User Progress (Language Learning)
- `GET /api/v1/userprogress` - Get all user progress
- `GET /api/v1/userprogress/lesson/:lessonId` - Get lesson progress
- `PUT /api/v1/userprogress/lesson/:lessonId/update` - Update lesson progress
- `GET /api/v1/userprogress/stats` - Get user statistics

## Type Definitions

The project includes comprehensive TypeScript types:

- **Models**: Database models for PostgreSQL and DynamoDB
- **API**: Request/response interfaces
- **Express**: Extended Express types with custom properties
- **Environment**: Environment variable types

## Database Schema

### PostgreSQL Tables
- `users` - User accounts and profiles
- `purchases` - Course purchase records

### DynamoDB Tables
- `LMS` - Course content and lectures
- `FreeLessons` - Language learning lessons
- `UserProgress` - User progress tracking

## Deployment

### Local Development
```bash
npm run dev
```

### AWS Lambda
```bash
# Build for Lambda
npm run build:lambda

# Deploy with SAM
sam build
sam deploy
```

## Environment Variables

Required environment variables:

```bash
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=admin
POSTGRES_HOST=localhost
POSTGRES_DB=lms_db
POSTGRES_PORT=5432

# AWS
AWS_REGION=ap-south-1

# JWT
JWT_SECRET=your-jwt-secret

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Razorpay
RAZORPAY_KEY_ID=your-razorpay-key
RAZORPAY_SECRET_KEY=your-razorpay-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## Development Notes

- All controllers include proper error handling and type safety
- CORS is configured for Chrome FedCM compatibility
- File uploads support both images and videos via Cloudinary
- Database connections are tested on startup
- Request logging includes browser detection for debugging

## Migration from JavaScript

This TypeScript version maintains 100% API compatibility with the original JavaScript version while adding:

- Complete type safety
- Better IDE support
- Compile-time error detection
- Self-documenting code through types
- Enhanced maintainability