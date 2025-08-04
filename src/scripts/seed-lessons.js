// ts-server/src/scripts/seed-lessons.js
// Script to seed language learning lessons to new DynamoDB Learning table

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

// Function to load lesson seed files from both our adapted files and original files
async function loadLessonSeedFiles() {
  const lessons = [];
  
  // First load our manually created lesson files
  const lessonsDir = path.join(__dirname, '..', 'seeds', 'lessons');
  if (fs.existsSync(lessonsDir)) {
    const lessonFiles = fs.readdirSync(lessonsDir).filter(file => file.endsWith('.json'));
    console.log(`📚 Found ${lessonFiles.length} adapted lesson files`);
    
    for (const fileName of lessonFiles) {
      const filePath = path.join(lessonsDir, fileName);
      const lessonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      lessons.push(lessonData);
    }
  }
  
  // Then convert remaining lessons from original reviewed folder
  const originalLessonsDir = path.join(__dirname, '..', '..', '..', 'server', 'seeds', 'reviewed');
  if (fs.existsSync(originalLessonsDir)) {
    const originalFiles = fs.readdirSync(originalLessonsDir).filter(file => file.endsWith('.json'));
    console.log(`📖 Found ${originalFiles.length} original lesson files to convert`);
    
    for (const fileName of originalFiles) {
      const filePath = path.join(originalLessonsDir, fileName);
      const originalLesson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Skip if we already have this lesson adapted
      const existingLesson = lessons.find(l => l.lessonId === originalLesson.lessonId);
      if (existingLesson) {
        continue;
      }
      
      // Convert original lesson to new schema
      const adaptedLesson = adaptLessonForNewSchema(originalLesson);
      lessons.push(adaptedLesson);
    }
  }
  
  return lessons;
}

// Function to adapt original lesson format to new TypeScript schema
function adaptLessonForNewSchema(originalLesson) {
  const unitId = originalLesson.unitId || originalLesson.lessonId.split('.')[0];
  const lessonOrder = parseInt(originalLesson.lessonId.split('.')[1]) || 1;
  
  return {
    // New schema required fields
    PK: `UNIT#${unitId}`,
    SK: `LESSON#${lessonOrder}`,
    lessonId: originalLesson.lessonId,
    unitId: unitId,
    lessonOrder: lessonOrder,
    title: originalLesson.title,
    titleHindi: originalLesson.titleHindi,
    description: originalLesson.description,
    descriptionHindi: originalLesson.descriptionHindi || originalLesson.description,
    difficulty: originalLesson.difficulty,
    estimatedTime: originalLesson.estimatedTime,
    prerequisites: originalLesson.prerequisites || [],
    vocabulary: originalLesson.vocabulary || [],
    exercises: originalLesson.exercises || [],
    
    // Enhanced fields for new schema
    supportedLanguages: ["en", "hi"],
    tags: extractTagsFromContent(originalLesson),
    competencyLevel: mapDifficultyToCompetency(originalLesson.difficulty),
    practiceType: inferPracticeType(originalLesson),
    completionRate: Math.random() * 20 + 75, // Random completion rate 75-95%
    averageRating: Math.random() * 1.5 + 3.5, // Random rating 3.5-5.0
    
    // Status and timestamps
    isActive: originalLesson.isActive || "active",
    createdAt: originalLesson.createdAt || new Date().toISOString(),
    updatedAt: originalLesson.updatedAt || new Date().toISOString()
  };
}

// Helper functions
function extractTagsFromContent(lesson) {
  const tags = [];
  const title = lesson.title?.toLowerCase() || '';
  const description = lesson.description?.toLowerCase() || '';
  
  // Common learning topics
  if (title.includes('hello') || title.includes('goodbye') || title.includes('greet')) tags.push('greetings');
  if (title.includes('number') || title.includes('संख्या')) tags.push('numbers');
  if (title.includes('please') || title.includes('thank')) tags.push('politeness');
  if (title.includes('color') || title.includes('रंग')) tags.push('colors');
  if (title.includes('family') || title.includes('परिवार')) tags.push('family');
  if (title.includes('food') || title.includes('खाना')) tags.push('food');
  if (description.includes('conversation') || description.includes('बातचीत')) tags.push('conversation');
  if (description.includes('shopping') || description.includes('खरीदारी')) tags.push('shopping');
  
  return tags.length > 0 ? tags : ['basic'];
}

function mapDifficultyToCompetency(difficulty) {
  const mapping = {
    'beginner': 'A1',
    'intermediate': 'A2',
    'advanced': 'B1'
  };
  return mapping[difficulty] || 'A1';
}

function inferPracticeType(lesson) {
  const hasTranslation = lesson.exercises?.some(ex => ex.type === 'translation');
  const hasConversation = lesson.exercises?.some(ex => ex.type === 'scenario_response');
  const hasVocabulary = lesson.vocabulary?.length > 0;
  
  if (hasConversation) return 'conversation';
  if (hasTranslation) return 'grammar';
  if (hasVocabulary) return 'vocabulary';
  return 'practice';
}

async function seedLessons() {
  try {
    console.log('🌱 Starting lesson seeding process...\n');
    
    // Check if Learning table exists
    try {
      const scanResult = await ddbDocClient.send(new ScanCommand({
        TableName: "Learning",
        Limit: 1
      }));
      console.log('✅ Connected to DynamoDB Learning table\n');
    } catch (error) {
      console.error('❌ Failed to connect to Learning table. Make sure it exists!');
      console.error('Run: node src/scripts/create-dynamodb-tables.js');
      process.exit(1);
    }
    
    // Load lesson seed data
    const lessonSeedData = await loadLessonSeedFiles();
    if (lessonSeedData.length === 0) {
      console.error('❌ No lesson seed files found!');
      process.exit(1);
    }
    
    console.log(`📚 Found ${lessonSeedData.length} lessons to seed\n`);
    
    // Group lessons by unit for better organization
    const lessonsByUnit = {};
    lessonSeedData.forEach(lesson => {
      const unitId = lesson.unitId;
      if (!lessonsByUnit[unitId]) {
        lessonsByUnit[unitId] = [];
      }
      lessonsByUnit[unitId].push(lesson);
    });
    
    // Seed lessons unit by unit
    for (const [unitId, unitLessons] of Object.entries(lessonsByUnit)) {
      console.log(`📖 Processing Unit ${unitId} (${unitLessons.length} lessons)`);
      
      for (const lessonData of unitLessons) {
        const lessonTitle = lessonData.title;
        
        try {
          // Check if lesson already exists
          const existingLesson = await ddbDocClient.send(new ScanCommand({
            TableName: "Learning",
            FilterExpression: "lessonId = :lessonId",
            ExpressionAttributeValues: {
              ":lessonId": lessonData.lessonId
            },
            Limit: 1
          }));
          
          if (existingLesson.Items && existingLesson.Items.length > 0) {
            console.log(`   ⚠️  Lesson ${lessonData.lessonId} already exists, skipping...`);
            continue;
          }
          
          // Insert lesson
          await ddbDocClient.send(new PutCommand({
            TableName: "Learning",
            Item: lessonData
          }));
          
          console.log(`   ✅ ${lessonData.lessonId}: ${lessonTitle}`);
          console.log(`      📝 ${lessonData.exercises?.length || 0} exercises, ${lessonData.vocabulary?.length || 0} vocabulary items`);
          console.log(`      🎯 ${lessonData.difficulty} level, ${lessonData.estimatedTime} minutes`);
          
        } catch (error) {
          console.error(`   ❌ Failed to create lesson ${lessonData.lessonId}:`, error.message);
        }
      }
      console.log('');
    }
    
    // Show summary
    const allLessons = await ddbDocClient.send(new ScanCommand({
      TableName: "Learning"
    }));
    
    console.log('🎉 Lesson seeding completed!');
    console.log(`📊 Total lessons in database: ${allLessons.Items?.length || 0}`);
    
    // Group summary by unit
    const unitSummary = {};
    allLessons.Items?.forEach(lesson => {
      const unitId = lesson.unitId;
      if (!unitSummary[unitId]) {
        unitSummary[unitId] = 0;
      }
      unitSummary[unitId]++;
    });
    
    console.log('\n📚 Lessons by unit:');
    Object.entries(unitSummary).forEach(([unitId, count]) => {
      console.log(`   Unit ${unitId}: ${count} lessons`);
    });
    
    console.log('\n💡 Next steps:');
    console.log('   1. Test lesson listing in your frontend');
    console.log('   2. Test lesson progress tracking');
    console.log('   3. Try the interactive exercises');
    
  } catch (error) {
    console.error('❌ Lesson seeding failed:', error);
    if (error.message) {
      console.error('Error details:', error.message);
    }
    process.exit(1);
  }
}

// Run the seeding
seedLessons();