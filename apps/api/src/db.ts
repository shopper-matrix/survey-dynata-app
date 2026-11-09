import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@survey-dynata/shared/db/client';

/** Database client for the API. Create one per process and reuse it. */
export function createDb(databaseUrl: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}
