import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const INITIAL_CAMERAS: any[] = [
  // Example dummy camera (Remove or edit this before production)
  /*
  {
    name: 'Front Yard',
    v380Id: '12345678',
    ip: '192.168.1.100',
    port: 8800,
    username: 'admin',
    password: 'password123',
    httpPort: 8080,
    rtspPort: 8554,
    hasOnvif: true,
  }
  */
];

async function main() {
  console.log('Seeding database...');

  // Hash password for admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // Seed Admin User
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      password: hashedPassword,
    },
    create: {
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
    },
  });
  console.log('Admin user seeded:', admin.username);

  // Seed Cameras
  for (const camData of INITIAL_CAMERAS) {
    const camera = await prisma.camera.upsert({
      where: { v380Id: camData.v380Id },
      update: camData,
      create: camData,
    });
    console.log(`Camera seeded: ${camera.name} (${camera.v380Id})`);
  }

  // Initial System Log
  await prisma.systemLog.create({
    data: {
      action: 'SYSTEM_INITIALIZATION',
      details: 'Database seeded with initial cameras and admin user.',
      module: 'System',
      level: 'INFO',
    },
  });
  console.log('System log initialized.');

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
