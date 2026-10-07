import "dotenv/config";
import argon2 from "argon2";
import { pool } from "./pool.js";

const isAdminSeed = process.argv.includes("--admin");
const prefix = isAdminSeed ? "SEED_ADMIN" : "SEED_USER";
const email = process.env[`${prefix}_EMAIL`]?.trim().toLowerCase();
const name = process.env[`${prefix}_NAME`]?.trim();
const password = process.env[`${prefix}_PASSWORD`];

if (!email || !name || !password || password.length < 12) {
  throw new Error(`Set ${prefix}_EMAIL, ${prefix}_NAME and a ${prefix}_PASSWORD of at least 12 characters in .env.`);
}
if (isAdminSeed && email === process.env.SEED_USER_EMAIL?.trim().toLowerCase()) {
  throw new Error("SEED_ADMIN_EMAIL must differ from SEED_USER_EMAIL so the employee test account keeps its role.");
}

try {
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
  await pool.query(
    `INSERT INTO users (email, name, password_hash, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (lower(email)) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash
     ${isAdminSeed ? ", role = EXCLUDED.role" : ""}`,
    [email, name, passwordHash, isAdminSeed ? "admin" : "employee"],
  );
  console.info(`Development account ready for ${email}.`);
} finally {
  await pool.end();
}