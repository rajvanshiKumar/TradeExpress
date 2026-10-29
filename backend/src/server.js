import http from 'http';
import app from './app.js';
import { ENV } from './config/env.js';
import prisma from './config/db.js';
import { initSocket } from './services/socketService.js';
import { bootstrapSuperAdmin } from '../scripts/bootstrapSuperAdmin.js';

async function startServer() {
  try {
    // Verify database connection
    await prisma.$connect();
    console.log('✓ Successfully connected to MySQL database via Prisma.');

    // Ensure Super Admin exists in MySQL on startup
    try {
      await bootstrapSuperAdmin();
      console.log('✓ Super Admin account ensured and verified.');
    } catch (bootstrapErr) {
      console.warn('⚠️ Super Admin bootstrap notice:', bootstrapErr?.message || bootstrapErr);
    }

    const httpServer = http.createServer(app);
    initSocket(httpServer);

    httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ [Port Conflict] Port ${ENV.PORT} is already in use by another running process.`);
        console.error(`👉 A previous instance of the backend is already running on port ${ENV.PORT}.`);
        console.error(`   To free port ${ENV.PORT}, terminate the existing process or run:`);
        console.error(`   powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort ${ENV.PORT}).OwningProcess -Force"\n`);
      } else {
        console.error('Server error:', err);
      }
      process.exit(1);
    });

    const server = httpServer.listen(ENV.PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 TradeExpress Backend Server running on port ${ENV.PORT}`);
      console.log(`📡 Base API URL: http://localhost:${ENV.PORT}/api`);
      console.log(`💬 Real-Time Messaging: Socket.IO enabled on port ${ENV.PORT}`);
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
