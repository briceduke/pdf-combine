import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { magicLink } from "better-auth/plugins"
import { attachDatabasePool } from "@vercel/functions"
import { Pool } from "pg"

import {
  isAuthConfigured,
  resolveAuthBaseUrl,
  resolveAuthSecret,
  resolveTrustedOrigins,
} from "@/lib/auth-env"
import { sendMagicLinkEmail } from "@/lib/send-magic-link"

const databaseUrl = process.env.DATABASE_URL
const pool = new Pool({
  connectionString: databaseUrl ?? "postgresql://127.0.0.1:5432/postgres",
  max: 1,
})

if (databaseUrl && process.env.VERCEL) {
  attachDatabasePool(pool)
}

/**
 * Better Auth server. Magic-link only; sessions live in Neon Postgres.
 */
export const auth = betterAuth({
  appName: "PDF Combine",
  baseURL: resolveAuthBaseUrl(),
  secret: resolveAuthSecret(),
  database: pool,
  trustedOrigins: resolveTrustedOrigins(),
  advanced: {
    database: {
      validateSchema: isAuthConfigured(),
    },
  },
  plugins: [
    magicLink({
      expiresIn: 60 * 10,
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail({ email, url })
      },
    }),
    nextCookies(),
  ],
})
