// ts-server/src/scripts/create-dynamodb-tables.js
// Script to create DynamoDB tables with new names: Courses, Learning, LearningProgress

import {
  DynamoDBClient,
  CreateTableCommand,
  ListTablesCommand,
  waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";
import dotenv from "dotenv";

dotenv.config();

// Initialize DynamoDB client for local development
const client = new DynamoDBClient({
  region: "ap-south-1",
  endpoint: "http://localhost:8000",
  credentials: {
    accessKeyId: "fakeMyKeyId",
    secretAccessKey: "fakeSecretAccessKey",
  },
});

// Updated table names
const TABLE_NAMES = {
  COURSES: "Courses",
  LEARNING: "Learning",
  LEARNING_PROGRESS: "LearningProgress",
};

// Table definitions with new names
const tableDefinitions = [
  // Table 1: Courses (formerly LMS)
  {
    TableName: TABLE_NAMES.COURSES,
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "SK", AttributeType: "S" },
      { AttributeName: "GSI1PK", AttributeType: "S" },
      { AttributeName: "GSI1SK", AttributeType: "S" },
      { AttributeName: "GSI2PK", AttributeType: "S" },
      { AttributeName: "GSI2SK", AttributeType: "S" },
      { AttributeName: "GSI3PK", AttributeType: "S" },
      { AttributeName: "GSI3SK", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "GSI1-ByCreator",
        KeySchema: [
          { AttributeName: "GSI1PK", KeyType: "HASH" },
          { AttributeName: "GSI1SK", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
        BillingMode: "PAY_PER_REQUEST",
      },
      {
        IndexName: "GSI2-ByPublishedStatus",
        KeySchema: [
          { AttributeName: "GSI2PK", KeyType: "HASH" },
          { AttributeName: "GSI2SK", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
        BillingMode: "PAY_PER_REQUEST",
      },
      {
        IndexName: "GSI3-ByContentType",
        KeySchema: [
          { AttributeName: "GSI3PK", KeyType: "HASH" },
          { AttributeName: "GSI3SK", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
        BillingMode: "PAY_PER_REQUEST",
      },
    ],
    BillingMode: "PAY_PER_REQUEST",
  },

  // Table 2: Learning (formerly FreeLessons)
  {
    TableName: TABLE_NAMES.LEARNING,
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "SK", AttributeType: "S" },
      { AttributeName: "isActive", AttributeType: "S" },
      { AttributeName: "unitId", AttributeType: "S" },
      { AttributeName: "competencyLevel", AttributeType: "S" },
      { AttributeName: "difficulty", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "ActiveLessonsIndex",
        KeySchema: [
          { AttributeName: "isActive", KeyType: "HASH" },
          { AttributeName: "unitId", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
        BillingMode: "PAY_PER_REQUEST",
      },
      {
        IndexName: "LanguageLevelIndex",
        KeySchema: [
          { AttributeName: "competencyLevel", KeyType: "HASH" },
          { AttributeName: "difficulty", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
        BillingMode: "PAY_PER_REQUEST",
      },
    ],
    BillingMode: "PAY_PER_REQUEST",
  },

  // Table 3: LearningProgress (formerly UserProgress)
  {
    TableName: TABLE_NAMES.LEARNING_PROGRESS,
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "SK", AttributeType: "S" },
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "unitId", AttributeType: "S" },
      { AttributeName: "status", AttributeType: "S" },
      { AttributeName: "streak", AttributeType: "N" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "UserUnitIndex",
        KeySchema: [
          { AttributeName: "userId", KeyType: "HASH" },
          { AttributeName: "unitId", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
        BillingMode: "PAY_PER_REQUEST",
      },
      {
        IndexName: "UserStatusIndex",
        KeySchema: [
          { AttributeName: "userId", KeyType: "HASH" },
          { AttributeName: "status", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
        BillingMode: "PAY_PER_REQUEST",
      },
      {
        IndexName: "UserStreakIndex",
        KeySchema: [
          { AttributeName: "userId", KeyType: "HASH" },
          { AttributeName: "streak", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
        BillingMode: "PAY_PER_REQUEST",
      },
    ],
    BillingMode: "PAY_PER_REQUEST",
  },
];

async function createDynamoDBTables() {
  console.log("🔄 CREATING LOCAL DYNAMODB TABLES WITH NEW NAMES...\n");

  try {
    // Check existing tables
    const { TableNames } = await client.send(new ListTablesCommand({}));
    console.log("📋 Existing DynamoDB tables:", TableNames);
    
    // Show old tables that can be deleted later
    const oldTables = ["LMS", "FreeLessons", "UserProgress"];
    const existingOldTables = TableNames.filter(table => oldTables.includes(table));
    if (existingOldTables.length > 0) {
      console.log("⚠️  Old tables found:", existingOldTables.join(", "));
      console.log("   (These can be deleted after migration)\n");
    }

    for (const tableDef of tableDefinitions) {
      const tableName = tableDef.TableName;

      if (TableNames.includes(tableName)) {
        console.log(`⏭️  Table ${tableName} already exists, skipping...`);
        continue;
      }

      console.log(`🔨 Creating table: ${tableName}...`);

      try {
        await client.send(new CreateTableCommand(tableDef));

        // Wait for table to be active
        console.log(`⏳ Waiting for ${tableName} to be active...`);
        await waitUntilTableExists(
          { client, maxWaitTime: 120 },
          { TableName: tableName }
        );

        console.log(`✅ Table ${tableName} created successfully`);

        // Show GSI info
        if (tableDef.GlobalSecondaryIndexes) {
          console.log(
            `   📊 GSIs: ${tableDef.GlobalSecondaryIndexes.map(
              (gsi) => gsi.IndexName
            ).join(", ")}`
          );
        }
      } catch (error) {
        console.error(`❌ Failed to create table ${tableName}:`, error.message);
        throw error;
      }
    }

    console.log("\n🎉 ALL NEW DYNAMODB TABLES CREATED SUCCESSFULLY!");
    console.log("\n📋 Summary:");
    console.log("   ✅ Courses (formerly LMS)");
    console.log("   ✅ Learning (formerly FreeLessons)");
    console.log("   ✅ LearningProgress (formerly UserProgress)");
    console.log("\n💡 Next steps:");
    console.log("   1. Update backend controllers to use new table names");
    console.log("   2. Migrate data from old tables if needed");
    console.log("   3. Delete old tables when ready:");
    console.log("      - aws dynamodb delete-table --table-name LMS --endpoint-url http://localhost:8000 --region ap-south-1");
    console.log("      - aws dynamodb delete-table --table-name FreeLessons --endpoint-url http://localhost:8000 --region ap-south-1");
    console.log("      - aws dynamodb delete-table --table-name UserProgress --endpoint-url http://localhost:8000 --region ap-south-1");
  } catch (error) {
    console.error("❌ DynamoDB table creation failed:", error.message);
    console.log("💡 Make sure local DynamoDB is running:");
    console.log('   cd C:\\aws-tools\\dynamodb_local\\');
    console.log('   java "-Djava.library.path=./DynamoDBLocal_lib" -jar DynamoDBLocal.jar -sharedDb');
    process.exit(1);
  }
}

// Run the script
createDynamoDBTables();