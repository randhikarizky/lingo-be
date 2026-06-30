import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = process.env.LOAD_TEST_PASSWORD ?? "loadtest123";
const COUNT = Number(process.env.LOAD_TEST_USER_COUNT ?? 15);

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  for (let index = 1; index <= COUNT; index += 1) {
    const email = `loadtest${index}@lingora.app`;

    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, name: `Load Test ${index}` },
      create: {
        email,
        name: `Load Test ${index}`,
        passwordHash,
      },
    });

    await prisma.userPlan.upsert({
      where: { userId: user.id },
      update: { plan: "FREE", status: "ACTIVE" },
      create: {
        userId: user.id,
        plan: "FREE",
        status: "ACTIVE",
      },
    });

    console.log(`Ready: ${email}`);
  }

  console.log(`\n${COUNT} load-test users ready. Password: ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
