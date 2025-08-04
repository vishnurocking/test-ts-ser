// ts-server/src/scripts/create-dynamodb-tables.ts
// Script to create DynamoDB tables with new names: Courses, Learning, LearningProgress

import { 
  DynamoDBClient, 
  CreateTableCommand, 
  DescribeTableCommand,
  ListTablesCommand,
  DeleteTableCommand,
  CreateTableCommandInput,
  AttributeDefinition,
  KeySchemaElement,
  GlobalSecondaryIndex
} from '@aws-sdk/client-dynamodb';
import { DynamoDBTableName, TABLE_NAMES } from '../config/databaseClients.js';

// Initialize DynamoDB client for local development
const ddbClient = new DynamoDBClient({
  region: 'ap-south-1',
  endpoint: process.env.DYNAMODB_LOCAL_ENDPOINT || 'http://localhost:8000',
  credentials: {
    accessKeyId: 'fakeMyKeyId',
    secretAccessKey: 'fakeSecretAccessKey',
  },
});

// Table definitions
const tableDefinitions: Record<DynamoDBTableName, CreateTableCommandInput> = {
  // Courses table (formerly LMS)
  [TABLE_NAMES.COURSES]: {
    TableName: TABLE_NAMES.COURSES,
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'GSI1PK', AttributeType: 'S' },
      { AttributeName: 'GSI1SK', AttributeType: 'S' },
      { AttributeName: 'GSI2PK', AttributeType: 'S' },
      { AttributeName: 'GSI2SK', AttributeType: 'S' },
      { AttributeName: 'GSI3PK', AttributeType: 'S' },
      { AttributeName: 'GSI3SK', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'GSI1-ByCreator',
        KeySchema: [
          { AttributeName: 'GSI1PK', KeyType: 'HASH' },
          { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
      {
        IndexName: 'GSI2-ByPublishedStatus',
        KeySchema: [
          { AttributeName: 'GSI2PK', KeyType: 'HASH' },
          { AttributeName: 'GSI2SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
      {
        IndexName: 'GSI3-ByContentType',
        KeySchema: [
          { AttributeName: 'GSI3PK', KeyType: 'HASH' },
          { AttributeName: 'GSI3SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  },

  // Learning table (formerly FreeLessons)
  [TABLE_NAMES.LEARNING]: {
    TableName: TABLE_NAMES.LEARNING,
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'isActive', AttributeType: 'S' },
      { AttributeName: 'unitId', AttributeType: 'S' },
      { AttributeName: 'competencyLevel', AttributeType: 'S' },
      { AttributeName: 'difficulty', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'ActiveLessonsIndex',
        KeySchema: [
          { AttributeName: 'isActive', KeyType: 'HASH' },
          { AttributeName: 'unitId', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
      {
        IndexName: 'LanguageLevelIndex',
        KeySchema: [
          { AttributeName: 'competencyLevel', KeyType: 'HASH' },
          { AttributeName: 'difficulty', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  },

  // LearningProgress table (formerly UserProgress)
  [TABLE_NAMES.LEARNING_PROGRESS]: {
    TableName: TABLE_NAMES.LEARNING_PROGRESS,
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'unitId', AttributeType: 'S' },
      { AttributeName: 'status', AttributeType: 'S' },
      { AttributeName: 'streak', AttributeType: 'N' },
    ],
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'UserUnitIndex',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'unitId', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
      {
        IndexName: 'UserStatusIndex',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'status', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
      {
        IndexName: 'UserStreakIndex',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'streak', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  },
};

// Helper function to wait for table to be active
async function waitForTableActive(tableName: string): Promise<void> {
  let isActive = false;
  let attempts = 0;
  const maxAttempts = 30;

  while (!isActive && attempts < maxAttempts) {
    try {
      const command = new DescribeTableCommand({ TableName: tableName });
      const response = await ddbClient.send(command);
      
      if (response.Table?.TableStatus === 'ACTIVE') {
        isActive = true;
      } else {
        console.log(`⏳ Waiting for ${tableName} to become active... (${attempts + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.log(`⏳ Table ${tableName} not ready yet... (${attempts + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    attempts++;
  }

  if (!isActive) {
    throw new Error(`Table ${tableName} did not become active within timeout period`);
  }
}

// Main function to create tables
async function createDynamoDBTables() {
  console.log('🔄 Starting DynamoDB table creation...\n');

  try {
    // Check DynamoDB connection
    console.log('🔌 Testing DynamoDB connection...');
    const listCommand = new ListTablesCommand({});
    const existingTables = await ddbClient.send(listCommand);
    console.log('✅ DynamoDB connection successful!');
    console.log(`📋 Existing tables: ${existingTables.TableNames?.join(', ') || 'none'}\n`);

    // Create each table
    for (const [tableName, tableConfig] of Object.entries(tableDefinitions)) {
      console.log(`📦 Creating table: ${tableName}`);
      
      try {
        // Check if table already exists
        const describeCommand = new DescribeTableCommand({ TableName: tableName });
        const existingTable = await ddbClient.send(describeCommand);
        
        if (existingTable.Table) {
          console.log(`⚠️  Table ${tableName} already exists. Skipping...`);
          continue;
        }
      } catch (error: any) {
        // Table doesn't exist, proceed with creation
        if (error.name === 'ResourceNotFoundException') {
          const createCommand = new CreateTableCommand(tableConfig);
          await ddbClient.send(createCommand);
          console.log(`✅ Table ${tableName} created successfully!`);
          
          // Wait for table to be active
          await waitForTableActive(tableName);
          console.log(`✅ Table ${tableName} is now active!\n`);
        } else {
          throw error;
        }
      }
    }

    // Verify all tables were created
    console.log('🔍 Verifying all tables...');
    const finalListCommand = new ListTablesCommand({});
    const finalTables = await ddbClient.send(finalListCommand);
    
    console.log('📋 Final table list:');
    const newTables = Object.keys(tableDefinitions);
    finalTables.TableNames?.forEach(table => {
      if (newTables.includes(table)) {
        console.log(`   ✅ ${table}`);
      }
    });

    console.log('\n🎉 DynamoDB tables created successfully!');
    console.log('📝 Next steps:');
    console.log('   1. Update controller files to use new table names');
    console.log('   2. Add sample data to tables');
    console.log('   3. Test application with new table structure');

  } catch (error) {
    console.error('❌ Error creating DynamoDB tables:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    process.exit(1);
  }
}

// Run the script
createDynamoDBTables();