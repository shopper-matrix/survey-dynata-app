import type { Prisma, PrismaClient } from '@survey-dynata/shared/db/client';

/** Records an admin action (who, what, on which object). Never pass passwords or secrets. */
export async function audit(
  db: PrismaClient | Prisma.TransactionClient,
  adminUserId: string | null,
  action: string,
  target?: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  await db.adminAuditLog.create({
    data: {
      adminUserId,
      action,
      target: target ?? null,
      details: details as Prisma.InputJsonValue,
    },
  });
}
