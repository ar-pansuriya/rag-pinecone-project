import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.warn("⚠️  DATABASE_URL is not set in .env. Skipping automated migration.");
    return;
  }

  console.log("🔄 Running automated database migration...");

  const pool = new pg.Pool({
    connectionString,
    // Supabase requires SSL for remote connections
    ssl: { rejectUnauthorized: false }
  });

  try {
    const sqlPath = path.join(__dirname, '..', 'supabase_setup.sql');
    const sqlScript = fs.readFileSync(sqlPath, 'utf8');

    // 1. Run the migration script
    await pool.query(sqlScript);
    console.log("✅ Migration script executed successfully!");

    // 2. Reload PostgREST schema cache
    await pool.query("NOTIFY pgrst, 'reload schema';");
    console.log("✅ Supabase API schema cache reloaded!");

  } catch (error) {
    console.error("❌ Migration failed:");
    console.error(error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
