import { PrismaClient } from '@prisma/client';

export const getPrismaClient = (dbUrl: string) =>
  new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });
