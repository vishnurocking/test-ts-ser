// ts-server/src/scripts/seed-users-standalone.js
// Standalone script to seed test users in PostgreSQL hybrid_db

import bcrypt from 'bcryptjs';
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const { Pool } = pg;

// PostgreSQL connection
const pgPool = new Pool({
  user: process.env.POSTGRES_USER || "postgres",
  host: process.env.POSTGRES_HOST || "localhost", 
  database: process.env.POSTGRES_DB || "hybrid_db",
  password: process.env.POSTGRES_PASSWORD || "admin",
  port: parseInt(process.env.POSTGRES_PORT || "5432"),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const testUsers = [
  {
    email: "tip@top.com",
    password: "123",
    name: "Tip Kumar",
    nickname: "Tip",
    role: "Learner",
  },
  {
    email: "admin@top.com",
    password: "123",
    name: "Admin User",
    nickname: "Admin",
    role: "Instructor",
  },
  {
    email: "tim@top.com",
    password: "123",
    name: "Tim Learner",
    nickname: "Learner",
    role: "Learner",
  },
];

async function seedUsers() {
  let client;
  
  try {
    console.log('🌱 Starting user seeding process...\n');
    
    // Get a client from the pool
    client = await pgPool.connect();
    console.log('✅ Connected to PostgreSQL (hybrid_db)\n');
    
    // Check existing users
    const existingUsersResult = await client.query('SELECT email, name, role FROM users');
    if (existingUsersResult.rows.length > 0) {
      console.log('📋 Existing users found:');
      existingUsersResult.rows.forEach(user => {
        console.log(`   - ${user.email} (${user.name}) - ${user.role}`);
      });
      console.log('');
    }
    
    // Insert each test user
    for (const userData of testUsers) {
      console.log(`👤 Processing user: ${userData.email}`);
      
      try {
        // Check if user already exists
        const checkResult = await client.query(
          'SELECT user_id FROM users WHERE email = $1',
          [userData.email]
        );
        
        if (checkResult.rows.length > 0) {
          console.log(`   ⚠️  User already exists, skipping...`);
          continue;
        }
        
        // Hash the password
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        
        // Insert the user
        const insertResult = await client.query(
          `INSERT INTO users (
            user_id, email, name, nickname, password, role,
            points, level, streak, language_preference,
            mother_tongue, primary_target_language, proficiency_level,
            daily_time_commitment, timezone, is_active, onboarding_completed
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10,
            $11, $12, $13,
            $14, $15, $16, $17
          ) RETURNING user_id, email, name, role`,
          [
            uuidv4(), // user_id
            userData.email,
            userData.name,
            userData.nickname,
            hashedPassword,
            userData.role,
            0, // points
            1, // level
            0, // streak
            'HIN-ENG', // language_preference
            'hi', // mother_tongue
            'en', // primary_target_language
            'beginner', // proficiency_level
            30, // daily_time_commitment
            'Asia/Kolkata', // timezone
            true, // is_active
            false // onboarding_completed
          ]
        );
        
        console.log(`   ✅ Created: ${userData.name} (${userData.role})`);
        console.log(`   📧 Email: ${userData.email}`);
        console.log(`   🔑 Password: ${userData.password} (stored as hash)`);
        console.log(`   🆔 ID: ${insertResult.rows[0].user_id}\n`);
        
      } catch (error) {
        console.error(`   ❌ Failed to create user ${userData.email}:`, error.message);
      }
    }
    
    // Show final user count
    const finalCountResult = await client.query('SELECT COUNT(*) FROM users');
    const userCount = finalCountResult.rows[0].count;
    
    console.log('🎉 User seeding completed!');
    console.log(`📊 Total users in database: ${userCount}`);
    console.log('\n🔐 Login credentials:');
    testUsers.forEach(user => {
      console.log(`   ${user.email} / ${user.password} (${user.role})`);
    });
    
  } catch (error) {
    console.error('❌ Error seeding users:', error);
    if (error.message) {
      console.error('Error details:', error.message);
    }
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pgPool.end();
  }
}

// Run the seeding
seedUsers();