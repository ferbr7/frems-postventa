import { PrismaClient } from '@prisma/client';

declare global {
  var __PRISMA__: PrismaClient | undefined;
}

const prisma = global.__PRISMA__ ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__PRISMA__ = prisma;
}

console.log('[prisma] instancia creada');

export default prisma;
