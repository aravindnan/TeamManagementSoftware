process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } = require("jose");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
let mongod, app, User, verifier, verifyGoogleIdToken, AppError;
let keys, otherKeys, jwks;

async function makeKeys(kid) {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid, alg: "RS256", use: "sig" };
  return { privateKey, publicKey, jwk, kid };
}

/** A Google-shaped ID token signed with `signer`. */
const makeToken = (claims = {}, { signer = keys, alg = "RS256", expiresIn = "1h", issuer = "https://accounts.google.com", audience = CLIENT_ID } = {}) =>
  new SignJWT({ email: "ann.lee@example.com", email_verified: true, name: "Ann Lee", given_name: "Ann", family_name: "Lee", ...claims })
    .setProtectedHeader({ alg, kid: signer.kid })
    .setSubject(claims.sub || "google-sub-1")
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(signer.privateKey);

const verify = (token, opts = {}) => verifyGoogleIdToken(token, { clientId: CLIENT_ID, jwks, ...opts });
const rejects = async (promise, status, message) => {
  await expect(promise).rejects.toMatchObject({ status, ...(message ? { message: expect.stringMatching(message) } : {}) });
};

beforeAll(async () => {
  keys = await makeKeys("good-key");
  otherKeys = await makeKeys("good-key"); // same key id, different material: an attacker's key
  jwks = createLocalJWKSet({ keys: [keys.jwk] });

  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  const { connectToDatabase } = require("../config/database");
  await connectToDatabase(process.env.MONGO_URI);
  ({ verifyGoogleIdToken, verifier } = require("../utils/googleVerifier"));
  ({ AppError } = require("../utils/AppError"));
  User = require("../model/user");
  app = require("../app").createApp();
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
});
afterEach(() => jest.restoreAllMocks());

describe("verifyGoogleIdToken (real signature checks with locally generated keys)", () => {
  test("accepts a valid token and normalises the profile", async () => {
    const profile = await verify(await makeToken({ email: "Ann.Lee@Example.com", picture: "https://lh3.googleusercontent.com/a" }));
    expect(profile).toEqual({
      googleId: "google-sub-1", email: "ann.lee@example.com", firstName: "Ann", lastName: "Lee", picture: "https://lh3.googleusercontent.com/a",
    });
  });

  test("falls back to splitting `name` and drops non-https pictures", async () => {
    const profile = await verify(await makeToken({ given_name: undefined, family_name: undefined, name: "Ann Marie Lee", picture: "http://insecure/x.png" }));
    expect([profile.firstName, profile.lastName, profile.picture]).toEqual(["Ann", "Marie Lee", ""]);
  });

  test("rejects a token minted for a different app (audience)", async () => {
    await rejects(verify(await makeToken({}, { audience: "someone-elses-app.apps.googleusercontent.com" })), 401, /invalid google credential/i);
  });

  test("rejects a token from another issuer", async () => {
    await rejects(verify(await makeToken({}, { issuer: "https://evil.example.com" })), 401);
  });

  test("accepts Google's bare 'accounts.google.com' issuer form", async () => {
    await expect(verify(await makeToken({}, { issuer: "accounts.google.com" }))).resolves.toMatchObject({ email: "ann.lee@example.com" });
  });

  test("rejects an expired token", async () => {
    await rejects(verify(await makeToken({}, { expiresIn: "-1m" })), 401);
  });

  test("rejects a token signed by a different key, even with the same key id", async () => {
    await rejects(verify(await makeToken({}, { signer: otherKeys })), 401);
  });

  test("rejects an unsigned token (alg: none)", async () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const unsigned = `${b64({ alg: "none", typ: "JWT" })}.${b64({
      iss: "https://accounts.google.com", aud: CLIENT_ID, sub: "x", email: "a@b.co", email_verified: true, exp: Math.floor(Date.now() / 1000) + 3600,
    })}.`;
    await rejects(verify(unsigned), 401);
  });

  test("rejects algorithm confusion (HS256 signed with the public key as the secret)", async () => {
    const forged = await new SignJWT({ email: "a@b.co", email_verified: true })
      .setProtectedHeader({ alg: "HS256", kid: keys.kid })
      .setSubject("x").setIssuer("https://accounts.google.com").setAudience(CLIENT_ID).setExpirationTime("1h")
      .sign(new TextEncoder().encode(JSON.stringify(keys.jwk)));
    await rejects(verify(forged), 401);
  });

  test.each([
    ["email_verified is false", { email_verified: false }],
    ["email_verified is missing", { email_verified: undefined }],
    ["there is no email", { email: undefined }],
  ])("rejects when %s (we never trust an unverified address)", async (_n, claims) => {
    await rejects(verify(await makeToken(claims)), 401, /not verified/i);
  });

  test("accepts email_verified given as the string 'true' (older tokens)", async () => {
    await expect(verify(await makeToken({ email_verified: "true" }))).resolves.toMatchObject({ email: "ann.lee@example.com" });
  });

  test("is a clear 503 when Google sign-in is not configured", async () => {
    await rejects(verifyGoogleIdToken("x.y.z", { clientId: "", jwks }), 503, /not configured/i);
  });

  test("garbage in, 401 out", async () => {
    for (const junk of ["not-a-jwt", "a.b.c", "", "....."]) await rejects(verify(junk), 401);
  });
});

describe("POST /auth/google", () => {
  const profile = (o = {}) => ({ googleId: "g-1", email: "ann.lee@example.com", firstName: "Ann", lastName: "Lee", picture: "", ...o });
  const asGoogle = (p) => jest.spyOn(verifier, "verify").mockResolvedValue(p);
  const signIn = (credential = "x".repeat(40)) => request(app).post("/auth/google").send({ credential });
  const dbUser = (q) => User.findOne(q).select("+password +googleId +tokenVersion");

  test("creates a verified account, signs in, and never exposes secrets", async () => {
    asGoogle(profile());
    const res = await signIn().expect(200);
    expect(res.body).toMatchObject({ success: true, loginStatus: true, isNewUser: true });
    expect(res.body.token).toBeUndefined();
    expect(res.headers["set-cookie"][0]).toMatch(/tms_token=.*HttpOnly/i);

    const user = await dbUser({ email: "ann.lee@example.com" });
    expect(user).toMatchObject({ username: "ann.lee", firstName: "Ann", lastName: "Lee", role: "Member", emailVerified: true, googleId: "g-1" });

    const cookie = res.headers["set-cookie"][0].split(";")[0];
    const me = (await request(app).get("/me").set("Cookie", cookie).expect(200)).body;
    expect(me.emailVerified).toBe(true);
    expect(me.password).toBeUndefined();
    expect(me.googleId).toBeUndefined();
  });

  test("a Google-only account cannot be entered with a password", async () => {
    asGoogle(profile());
    await signIn();
    for (const password of ["", "password", "Passw0rd!x", "g-1"]) {
      await request(app).post("/login").send({ username: "ann.lee", password: password || "x" }).expect(401);
    }
  });

  test("signing in again finds the same account", async () => {
    asGoogle(profile());
    const first = (await signIn()).body;
    const second = (await signIn()).body;
    expect(second.isNewUser).toBe(false);
    expect(second.userId).toBe(first.userId);
    expect(await User.countDocuments()).toBe(1);
  });

  test("two people with the same email local part get different usernames", async () => {
    asGoogle(profile({ googleId: "g-a", email: "sam@a.example" }));
    await signIn();
    asGoogle(profile({ googleId: "g-b", email: "sam@b.example" }));
    await signIn();
    const names = (await User.find()).map((u) => u.username);
    expect(new Set(names).size).toBe(2);
    expect(names).toContain("sam");
  });

  test("odd email local parts still give a valid username", async () => {
    asGoogle(profile({ googleId: "g-x", email: "+++@weird.example" }));
    await signIn();
    expect((await User.findOne({ googleId: "g-x" }).select("+googleId")).username).toMatch(/^[a-z0-9_.-]{3,}$/);
  });

  test("links an existing UNVERIFIED password account, but locks out whoever set that password", async () => {
    // someone registers with ann's address and picks a password (we never verified they own it)
    await request(app).post("/register").send({
      username: "squatter", email: "ann.lee@example.com", password: "SquatPass1", firstName: "Not", lastName: "Ann", role: "Dev", dateOfBirth: "1990-01-01",
    }).expect(201);
    const squatterCookie = (await request(app).post("/login").send({ username: "squatter", password: "SquatPass1" })).headers["set-cookie"][0].split(";")[0];
    await request(app).get("/me").set("Cookie", squatterCookie).expect(200);

    // the real Ann signs in with Google
    asGoogle(profile());
    const res = await signIn().expect(200);
    expect(res.body.isNewUser).toBe(false);

    const user = await dbUser({ email: "ann.lee@example.com" });
    expect(user).toMatchObject({ username: "squatter", emailVerified: true, googleId: "g-1" });
    await request(app).post("/login").send({ username: "squatter", password: "SquatPass1" }).expect(401); // password dead
    await request(app).get("/me").set("Cookie", squatterCookie).expect(401); // existing session revoked
    const annCookie = res.headers["set-cookie"][0].split(";")[0];
    await request(app).get("/me").set("Cookie", annCookie).expect(200); // Ann herself is fine
  });

  test("rejects an unverifiable credential without creating anything", async () => {
    const real = jest.requireActual("../utils/googleVerifier").verifyGoogleIdToken;
    jest.spyOn(verifier, "verify").mockImplementation((c) => real(c, { clientId: CLIENT_ID, jwks }));
    await signIn("this-is-not-a-real-google-token-at-all").expect(401);
    expect(await User.countDocuments()).toBe(0);
  });

  test("an unverified Google email is refused", async () => {
    jest.spyOn(verifier, "verify").mockRejectedValue(new AppError(401, "Your Google email address is not verified"));
    const res = await signIn().expect(401);
    expect(res.body.error).toMatch(/not verified/i);
    expect(await User.countDocuments()).toBe(0);
  });

  test("a missing or absurd credential is a 400", async () => {
    await request(app).post("/auth/google").send({}).expect(400);
    await request(app).post("/auth/google").send({ credential: "short" }).expect(400);
    await request(app).post("/auth/google").send({ credential: "x".repeat(9000) }).expect(400);
  });

  test("password sign-ups start unverified", async () => {
    await request(app).post("/register").send({
      username: "pwuser", email: "pw@example.com", password: "Passw0rd!x", firstName: "P", lastName: "W", role: "Dev", dateOfBirth: "1990-01-01",
    }).expect(201);
    expect((await User.findOne({ username: "pwuser" })).emailVerified).toBe(false);
  });
});
