import "dotenv/config";

process.env.PHI_ENCRYPTION_KEY = Buffer.from(
  "0123456789abcdef0123456789abcdef",
  "utf8",
).toString("base64");

process.env.AUTH_SECRET = "dev-auth-secret-for-tests-only-32b";

process.env.CPF_HASH_KEY = Buffer.from(
  "fedcba9876543210fedcba9876543210",
  "utf8",
).toString("base64");
