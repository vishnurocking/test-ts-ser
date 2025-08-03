// ts-server/src/index-local.ts
// Local development server entry point

import app from './app-local.js';
import { testAllConnections } from './config/databaseClients.js';

const PORT = process.env.PORT || 3000;

// Test database connections on startup
async function startServer(): Promise<void> {
  try {
    console.log("🔄 Testing database connections...");
    const connectionsOk = await testAllConnections();
    
    if (!connectionsOk) {
      console.warn("⚠️ Some database connections failed, but starting server anyway for development");
    }

    app.listen(PORT, () => {
      console.log(`\n🚀 TypeScript Local Server running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`🔗 API Base: http://localhost:${PORT}/api/v1`);
      console.log(`\n📋 Available Endpoints:`);
      console.log(`   - POST /api/v1/user/register`);
      console.log(`   - POST /api/v1/user/login`);
      console.log(`   - POST /api/v1/user/google-login`);
      console.log(`   - GET  /api/v1/user/profile`);
      console.log(`   - GET  /api/v1/course/published`);
      console.log(`   - GET  /api/v1/freelessons/active`);
      console.log(`   - GET  /api/v1/userprogress/stats`);
      console.log(`\n✨ Ready for development!`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Handle process signals gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();