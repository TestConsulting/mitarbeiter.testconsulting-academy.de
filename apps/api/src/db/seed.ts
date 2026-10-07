import "dotenv/config";
import argon2 from "argon2";
import { pool } from "./pool.js";
import { provisionSingleAccount } from "./single-account.js";

const email = process.env.SEED_USER_EMAIL?.trim().toLowerCase();
const name = process.env.SEED_USER_NAME?.trim();
const password = process.env.SEED_USER_PASSWORD;

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320 ||
    !name || !password || password.length < 12 || password.length > 1024) {
  throw new Error("Set a valid SEED_USER_EMAIL, SEED_USER_NAME and SEED_USER_PASSWORD (12-1024 characters) in .env.");
}

try {
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
  await provisionSingleAccount(pool, { email, name, passwordHash });
  console.info(`Single administrator account ready for ${email}. Other accounts and existing sessions have been removed.`);
} finally {
  await pool.end();
}