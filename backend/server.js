const config = require("./config/env");
const { connectToDatabase, disconnectFromDatabase } = require("./config/database");
const { createApp } = require("./app");

async function main() {
  await connectToDatabase();
  console.log("Connected to database");

  const server = createApp().listen(config.port, () => console.log(`API listening on :${config.port}`));

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectFromDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});
