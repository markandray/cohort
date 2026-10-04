import { prisma } from '../config/database';
import { createAdmin } from '../services/admin.service';

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set');
  }

  const result = await createAdmin(email, password, process.env.ADMIN_NAME?.trim() || 'Admin');
  console.log(
    result.created
      ? `[create-admin] created admin ${email}`
      : `[create-admin] admin ${email} already exists, nothing to do`
  );
}

main()
  .catch((err) => {
    console.error('[create-admin] failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());