// ts-server/src/scripts/seed-courses.js
// Script to seed courses to new DynamoDB Courses table

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DynamoDB client for local development
const ddbClient = new DynamoDBClient({
  region: "ap-south-1",
  endpoint: "http://localhost:8000",
  credentials: {
    accessKeyId: "fakeMyKeyId",
    secretAccessKey: "fakeSecretAccessKey",
  },
});

const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

// Admin User ID (the instructor account we created)
const ADMIN_USER_ID = "3900157e-770d-4cfb-9338-eadcc0cdfb92";

// Function to load course seed files
function loadCourseSeedFiles() {
  const seedsDir = path.join(__dirname, '..', 'seeds');
  const courseFiles = ['course-1.json', 'course-2.json'];
  const courses = [];

  for (const fileName of courseFiles) {
    const filePath = path.join(seedsDir, fileName);
    if (fs.existsSync(filePath)) {
      const courseData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      courses.push(courseData);
    } else {
      console.warn(`⚠️  Seed file not found: ${fileName}`);
    }
  }

  return courses;
}

// Function to replace placeholders with actual admin user ID
function processCourseSeedData(courseSeedData) {
  return courseSeedData.map(courseData => {
    // Deep clone to avoid mutating original data
    const processedCourse = JSON.parse(JSON.stringify(courseData));
    
    // Replace ADMIN_USER_ID placeholders
    processedCourse.courseMetadata.creator = ADMIN_USER_ID;
    processedCourse.courseMetadata.GSI1PK = `USER#${ADMIN_USER_ID}`;
    
    // Update timestamps to current time
    const now = new Date().toISOString();
    processedCourse.courseMetadata.createdAt = now;
    
    processedCourse.lectures = processedCourse.lectures.map((lecture, index) => {
      const lectureTime = new Date(Date.now() + (index * 5 * 60 * 1000)).toISOString(); // 5 min intervals
      return {
        ...lecture,
        createdAt: lectureTime
      };
    });
    
    return processedCourse;
  });
}

async function seedCourses() {
  try {
    console.log('🌱 Starting course seeding process...\n');
    console.log(`👨‍🏫 Assigning courses to Admin User: ${ADMIN_USER_ID}\n`);
    
    // Check if Courses table exists
    try {
      const scanResult = await ddbDocClient.send(new ScanCommand({
        TableName: "Courses",
        Limit: 1
      }));
      console.log('✅ Connected to DynamoDB Courses table\n');
    } catch (error) {
      console.error('❌ Failed to connect to Courses table. Make sure it exists!');
      console.error('Run: node src/scripts/create-dynamodb-tables.js');
      process.exit(1);
    }
    
    // Load and process course seed data
    const rawCourseSeedData = loadCourseSeedFiles();
    if (rawCourseSeedData.length === 0) {
      console.error('❌ No course seed files found!');
      process.exit(1);
    }
    
    const courseSeedData = processCourseSeedData(rawCourseSeedData);
    console.log(`📚 Found ${courseSeedData.length} courses to seed\n`);
    
    for (const courseData of courseSeedData) {
      const courseTitle = courseData.courseMetadata.courseTitle;
      console.log(`📚 Processing course: ${courseTitle}`);
      
      try {
        // Check if course already exists
        const existingCourse = await ddbDocClient.send(new ScanCommand({
          TableName: "Courses",
          FilterExpression: "courseId = :courseId",
          ExpressionAttributeValues: {
            ":courseId": courseData.courseMetadata.courseId
          },
          Limit: 1
        }));
        
        if (existingCourse.Items && existingCourse.Items.length > 0) {
          console.log(`   ⚠️  Course already exists, skipping...`);
          continue;
        }
        
        // Insert course metadata
        await ddbDocClient.send(new PutCommand({
          TableName: "Courses",
          Item: courseData.courseMetadata
        }));
        
        console.log(`   ✅ Course metadata created`);
        console.log(`   📖 Title: ${courseTitle}`);
        console.log(`   💰 Price: ₹${courseData.courseMetadata.coursePrice}`);
        console.log(`   🏷️  Category: ${courseData.courseMetadata.category}`);
        
        // Insert lectures
        for (const lecture of courseData.lectures) {
          await ddbDocClient.send(new PutCommand({
            TableName: "Courses",
            Item: lecture
          }));
        }
        
        console.log(`   🎥 ${courseData.lectures.length} lectures added`);
        console.log(`   🆔 Course ID: ${courseData.courseMetadata.courseId}\n`);
        
      } catch (error) {
        console.error(`   ❌ Failed to create course ${courseTitle}:`, error.message);
      }
    }
    
    // Show summary
    const allCourses = await ddbDocClient.send(new ScanCommand({
      TableName: "Courses",
      FilterExpression: "SK = :sk",
      ExpressionAttributeValues: {
        ":sk": "METADATA"
      }
    }));
    
    console.log('🎉 Course seeding completed!');
    console.log(`📊 Total courses in database: ${allCourses.Items?.length || 0}`);
    console.log('\n📚 Available courses:');
    allCourses.Items?.forEach(course => {
      console.log(`   - ${course.courseTitle} (₹${course.coursePrice}) - ${course.category}`);
    });
    console.log('\n💡 Next steps:');
    console.log('   1. Test course listing in your frontend');
    console.log('   2. Test course purchase flow');
    console.log('   3. Add more courses if needed');
    
  } catch (error) {
    console.error('❌ Course seeding failed:', error);
    if (error.message) {
      console.error('Error details:', error.message);
    }
    process.exit(1);
  }
}

// Run the seeding
seedCourses();