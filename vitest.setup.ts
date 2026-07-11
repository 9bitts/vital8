import "dotenv/config";

process.env.PHI_ENCRYPTION_KEY = Buffer.from(
  "0123456789abcdef0123456789abcdef",
  "utf8",
).toString("base64");

process.env.AUTH_SECRET = "dev-auth-secret-for-tests-only-32b";
