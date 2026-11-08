// Shared Postgres helpers for the integration tests. They run against a REAL PostgreSQL server:
//   TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/tms_test npm test
// The tables are created by `prisma migrate deploy` (see test/globalSetup.js) and emptied before every test.
const { prisma } = require("../../db/prisma");

const url = () => process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "";

/** Refuses to run against anything that does not look like a throw-away test database. */
function assertTestDatabase() {
  const name = url().split("?")[0].split("/").pop();
  if (!name || !/test/i.test(name)) {
    throw new Error(
      `Refusing to run tests: database name "${name}" must contain "test" because the tests wipe it. ` +
        "Set TEST_DATABASE_URL, e.g. postgresql://user:pass@localhost:5432/tms_test"
    );
  }
}

let tables;
async function resetDatabase() {
  if (!tables) {
    const rows = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'`;
    tables = rows.map((r) => `"${r.tablename}"`).join(", ");
  }
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}

module.exports = { prisma, assertTestDatabase, resetDatabase, url };
