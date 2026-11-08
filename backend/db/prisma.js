const { PrismaClient } = require("@prisma/client");
const config = require("../config/env");
const { newId } = require("./objectId");

// Models whose primary key is a composite of two foreign keys have no `id` column to fill in.
const HAS_ID = (model) => !["WorkspaceMember", "ProjectMember"].includes(model);

// Fills in `id` on every create so call sites never have to think about it.
const withIds = {
  query: {
    $allModels: {
      create({ model, args, query }) {
        if (HAS_ID(model) && args.data && args.data.id === undefined) args.data.id = newId();
        return query(args);
      },
      createMany({ model, args, query }) {
        if (HAS_ID(model)) {
          const rows = Array.isArray(args.data) ? args.data : [args.data];
          for (const row of rows) if (row.id === undefined) row.id = newId();
        }
        return query(args);
      },
      upsert({ model, args, query }) {
        if (HAS_ID(model) && args.create && args.create.id === undefined) args.create.id = newId();
        return query(args);
      },
    },
  },
};

const prisma = new PrismaClient({
  datasourceUrl: config.databaseUrl,
  log: config.isTest ? [] : ["warn", "error"],
}).$extends(withIds);

const connectToDatabase = () => prisma.$connect();
const disconnectFromDatabase = () => prisma.$disconnect();

module.exports = { prisma, connectToDatabase, disconnectFromDatabase };
