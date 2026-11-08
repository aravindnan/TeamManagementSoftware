// Kept as the single import point for server.js and tests; the client itself lives in db/prisma.js.
const { connectToDatabase, disconnectFromDatabase } = require("../db/prisma");

module.exports = { connectToDatabase, disconnectFromDatabase };
