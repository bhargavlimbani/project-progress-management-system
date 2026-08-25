const { PrismaClient } = require("@prisma/client");

// Single shared Prisma instance for the whole process.
const prisma = global.__prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") global.__prisma = prisma;

module.exports = prisma;
