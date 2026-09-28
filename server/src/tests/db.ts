import { prisma } from '../config/database';
import redis from '../config/redis';

const TABLES = [
  'Deadline',
  'Note',
  'GroupMember',
  'StudyGroup',
  'Submission',
  'Assignment',
  'Enrollment',
  'Class',
  'User',
];

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`
  );
}

export async function disconnectDb() {
  await prisma.$disconnect();
  await redis.quit();
}