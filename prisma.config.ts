import { existsSync } from "node:fs";
import { defineConfig, env } from "prisma/config";

// The Prisma CLI doesn't read Next's .env.local on its own. CI has no .env.local and sets DATABASE_URL directly.
if (existsSync(".env.local")) process.loadEnvFile?.(".env.local");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") }
});
