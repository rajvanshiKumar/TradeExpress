import app from './app.js';
import { ENV } from './config/env.js';
import prisma from './config/db.js';

async function startServer() {
  try {
    // Verify database connection
    await prisma.$connect();
    console.log('✓ Successfully connected to MySQL database via Prisma.');

    const server = app.listen(ENV.PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 TradeSphere Backend Server running on port ${ENV.PORT}`);
      console.log(`📡 Base API URL: http://localhost:${ENV.PORT}/api`);
      console.log(`🌐 Health Check: http://localhost:${ENV.PORT}/api/health`);
      console.log(`💻 Connected to Frontend at ${ENV.FRONTEND_URL}`);
      console.log(`💳 Payment Gateway Mode: ${ENV.PAYMENT_GATEWAY_MODE}`);
      console.log(`=======================================================`);
    });

    const gracefulShutdown = async () => {
      console.log('\nShutting down gracefully...');
      server.close(async () => {
        await prisma.$disconnect();
        console.log('Database disconnected. Process exited.');
        process.exit(0);
      });
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
