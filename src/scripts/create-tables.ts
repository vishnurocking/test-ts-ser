// ts-server/src/scripts/create-tables.ts
// Script to create PostgreSQL tables in hybrid_db database

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pgPool } from '../config/databaseClients.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createTables() {
  let client;
  
  try {
    console.log('🔄 Connecting to hybrid_db database...');
    client = await pgPool.connect();
    
    // Read the SQL schema file
    const schemaPath = path.join(__dirname, '..', 'schema', 'postgresql-schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📄 Executing PostgreSQL schema...');
    
    // Execute the schema SQL
    await client.query(schemaSql);
    
    console.log('✅ PostgreSQL tables created successfully in hybrid_db!');
    
    // Test the created tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    console.log('📋 Created tables:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Test the views
    const viewsResult = await client.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('👀 Created views:');
    viewsResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
  } catch (error) {
    console.error('❌ Error creating tables:', error);
    if (error instanceof Error) {
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

// Run the script
createTables();