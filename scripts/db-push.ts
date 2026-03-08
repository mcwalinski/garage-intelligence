import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import postgres from "postgres";

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL");
  }

  const sql = postgres(databaseUrl, {
    ssl: "require",
    max: 1
  });

  try {
    const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
    const migrationFiles = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of migrationFiles) {
      const migration = readFileSync(path.join(migrationsDir, file), "utf8");
      await sql.unsafe(migration);
      console.log(`Applied migration ${file}`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
