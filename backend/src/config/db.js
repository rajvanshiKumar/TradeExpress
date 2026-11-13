import { PrismaClient } from '@prisma/client';

const logLevels = ['error', 'warn'];
if (process.env.PRISMA_LOG_QUERIES === 'true') {
  logLevels.push('query');
}

const prisma = new PrismaClient({
  log: logLevels,
});

export default prisma;

