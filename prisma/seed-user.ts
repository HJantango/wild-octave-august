import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding initial user...');

  const email = 'heathjansse@gmail.com';
  const password = 'Nintendo:)2100w';
  const SALT_ROUNDS = 10;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    console.log('✅ User already exists:', email);
    return;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: 'Heath Jansse',
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('✅ User created successfully:', user.email);
  console.log('   ID:', user.id);
  console.log('   Role:', user.role);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
