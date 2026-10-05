import "dotenv/config";
import argon2 from "argon2";
import { pool } from "./pool.js";

const email = process.env.SEED_USER_EMAIL?.trim().toLowerCase();
const name = process.env.SEED_USER_NAME?.trim();
const password = process.env.SEED_USER_PASSWORD;

if (!email || !name || !password || password.length < 12) {
  throw new Error("Set SEED_USER_EMAIL, SEED_USER_NAME and a SEED_USER_PASSWORD of at least 12 characters in .env.");
}

try {
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
  await pool.query(
    `INSERT INTO users (email, name, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (lower(email)) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash`,
    [email, name, passwordHash],
  );
  console.info(`Development account ready for ${email}.`);
} finally {
  await pool.end();
}