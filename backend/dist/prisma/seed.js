"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma = new client_1.PrismaClient();
const INITIAL_CAMERAS = [
    {
        name: 'Camera 1',
        v380Id: '96555529',
        ip: '10.10.10.21',
        port: 8800,
        username: '96555529',
        password: 'Nuger.27102022',
        httpPort: 8080,
        rtspPort: 8554,
        hasOnvif: true,
    },
    {
        name: 'Camera 2',
        v380Id: '80842115',
        ip: '10.10.10.23',
        port: 8800,
        username: '80842115',
        password: 'Nuger.27102022',
        httpPort: 8081,
        rtspPort: 8555,
        hasOnvif: false,
    },
];
async function main() {
    console.log('Seeding database...');
    // Hash password for admin user
    const hashedPassword = await bcrypt_1.default.hash('admin123', 10);
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
