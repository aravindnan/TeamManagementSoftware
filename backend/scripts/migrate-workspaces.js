// Usage: npm run migrate:workspaces   (uses the database configured in .env)
const { connectToDatabase, disconnectFromDatabase } = require("../config/database");
const { migrateLegacyProjects } = require("../utils/migrateWorkspaces");

(async () => {
  await connectToDatabase();
  const summary = await migrateLegacyProjects();
  console.log("Workspace migration finished:", summary);
  await disconnectFromDatabase();
})().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
