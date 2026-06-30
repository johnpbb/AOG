// One-time cutover script: migrates the single shared ADMIN_PASSWORD into a
// named SUPER_ADMIN User row, so there's no lockout when the login system
// switches from a shared password to per-staff accounts.
//
// Run with: npx tsx prisma/seed-admin-user.ts
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

async function main() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_PASSWORD is not set — nothing to migrate");
  }

  const email = process.env.ADMIN_SEED_EMAIL || "admin@agfj100.com";
  const name = process.env.ADMIN_SEED_NAME || "Admin";
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "SUPER_ADMIN", isActive: true },
    create: { name, email, passwordHash, role: "SUPER_ADMIN" },
  });

  console.log(`Seeded SUPER_ADMIN user: ${user.email} (login with the existing ADMIN_PASSWORD value)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
