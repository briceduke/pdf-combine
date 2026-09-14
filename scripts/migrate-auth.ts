/**
 * Apply Better Auth tables to Neon. Set DATABASE_URL first (pooled).
 *
 * @example
 * DATABASE_URL="postgresql://..." npm run db:migrate
 */
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Client } from "pg"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error(
    "Set DATABASE_URL to the Neon pooled connection string, then retry."
  )
}

const schemaPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../db/auth-schema.sql"
)
const sql = await readFile(schemaPath, "utf8")
const client = new Client({ connectionString: databaseUrl })

await client.connect()

try {
  await client.query(sql)
  console.log("Better Auth tables are ready.")
} finally {
  await client.end()
}
