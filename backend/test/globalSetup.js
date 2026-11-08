// Runs once before the test files: makes sure the test database has the current schema.
const { execFileSync } = require("child_process");
const path = require("path");

module.exports = async () => {
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  const name = (url || "").split("?")[0].split("/").pop();
  if (!url || !/test/i.test(name)) {
    throw new Error(
      "Set TEST_DATABASE_URL to a PostgreSQL database whose name contains \"test\" (the tests wipe it), " +
        "e.g. postgresql://user:pass@localhost:5432/tms_test. See README.md > Tests."
    );
  }
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
};
