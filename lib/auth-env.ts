export interface AuthEnv {
  readonly BETTER_AUTH_SECRET?: string
  readonly BETTER_AUTH_URL?: string
  readonly DATABASE_URL?: string
  readonly NEXT_PUBLIC_APP_URL?: string
  readonly NODE_ENV?: string
  readonly RESEND_API_KEY?: string
  readonly RESEND_FROM_EMAIL?: string
  readonly VERCEL_BRANCH_URL?: string
  readonly VERCEL_PROJECT_PRODUCTION_URL?: string
  readonly VERCEL_URL?: string
}

const LOCAL_ORIGIN = "http://localhost:3000"
const PRODUCTION_ORIGIN = "https://pdf.briceduke.dev"
const BUILD_PLACEHOLDER_SECRET = "insecure-build-placeholder-secret-32b"

function readEnv(env: AuthEnv, key: keyof AuthEnv): string | undefined {
  const value = env[key]
  return value && value.length > 0 ? value : undefined
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url
}

function toHttpsOrigin(host: string): string {
  return host.startsWith("http://") || host.startsWith("https://")
    ? stripTrailingSlash(host)
    : `https://${host}`
}

/**
 * True when Neon and Better Auth secret are both present.
 *
 * @param env - Process env, injectable in verify scripts.
 * @returns Whether session lookups can run.
 */
export function isAuthConfigured(env: AuthEnv = process.env): boolean {
  return Boolean(readEnv(env, "DATABASE_URL") && readEnv(env, "BETTER_AUTH_SECRET"))
}

/**
 * True when Resend can deliver magic-link mail.
 *
 * @param env - Process env, injectable in verify scripts.
 * @returns Whether production email send is wired.
 */
export function isMagicLinkEmailConfigured(
  env: AuthEnv = process.env
): boolean {
  return Boolean(
    readEnv(env, "RESEND_API_KEY") && readEnv(env, "RESEND_FROM_EMAIL")
  )
}

/**
 * Better Auth base URL: explicit env, else this Vercel deployment, else local.
 *
 * Set `BETTER_AUTH_URL` on Production only (`https://pdf.briceduke.dev`) so
 * Preview still uses `VERCEL_URL`.
 *
 * @param env - Process env, injectable in verify scripts.
 * @returns Origin with no trailing slash.
 */
export function resolveAuthBaseUrl(env: AuthEnv = process.env): string {
  const explicit =
    readEnv(env, "BETTER_AUTH_URL") ?? readEnv(env, "NEXT_PUBLIC_APP_URL")

  if (explicit) {
    return stripTrailingSlash(explicit)
  }

  const vercelUrl = readEnv(env, "VERCEL_URL")
  if (vercelUrl) {
    return toHttpsOrigin(vercelUrl)
  }

  return LOCAL_ORIGIN
}

/**
 * Secret for Better Auth. Placeholder is only so `next build` can import the
 * module; production must set `BETTER_AUTH_SECRET`.
 *
 * @param env - Process env, injectable in verify scripts.
 * @returns Secret string of at least 32 characters when configured.
 */
export function resolveAuthSecret(env: AuthEnv = process.env): string {
  return readEnv(env, "BETTER_AUTH_SECRET") ?? BUILD_PLACEHOLDER_SECRET
}

/**
 * Resend `from` address. Must match a verified domain in production.
 *
 * @param env - Process env, injectable in verify scripts.
 * @returns Address like `PDF Combine <auth@pdf.briceduke.dev>`.
 */
export function resolveMagicLinkFromAddress(
  env: AuthEnv = process.env
): string {
  const from = readEnv(env, "RESEND_FROM_EMAIL")
  if (from) {
    return from
  }

  if (env.NODE_ENV === "production") {
    throw new Error("RESEND_FROM_EMAIL is required in production.")
  }

  return "PDF Combine <onboarding@resend.dev>"
}

/**
 * Origins allowed to complete Better Auth cookie flows.
 *
 * @param env - Process env, injectable in verify scripts.
 * @returns Deduped origin list.
 */
export function resolveTrustedOrigins(env: AuthEnv = process.env): string[] {
  const origins = new Set<string>([LOCAL_ORIGIN, PRODUCTION_ORIGIN])

  for (const key of [
    "BETTER_AUTH_URL",
    "NEXT_PUBLIC_APP_URL",
    "VERCEL_URL",
    "VERCEL_BRANCH_URL",
    "VERCEL_PROJECT_PRODUCTION_URL",
  ] as const) {
    const value = readEnv(env, key)
    if (value) {
      origins.add(toHttpsOrigin(value))
    }
  }

  return [...origins]
}
