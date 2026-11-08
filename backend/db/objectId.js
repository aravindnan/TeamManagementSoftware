// Generates ids in the MongoDB ObjectId format (24 hex characters: 4-byte timestamp, 5 random bytes
// per process, 3-byte counter). They are monotonic within a process and sort by creation time, which
// the cursor-paginated feeds rely on, and they keep the id shape the web app and API already use.
const crypto = require("crypto");

const processUnique = crypto.randomBytes(5);
let counter = crypto.randomInt(0, 0xffffff);

function newId() {
  const buf = Buffer.alloc(12);
  buf.writeUInt32BE(Math.floor(Date.now() / 1000), 0);
  processUnique.copy(buf, 4);
  counter = (counter + 1) & 0xffffff;
  buf.writeUIntBE(counter, 9, 3);
  return buf.toString("hex");
}

const isId = (value) => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

module.exports = { newId, isId };
