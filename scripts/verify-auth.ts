import {
  isAuthConfigured,
  isMagicLinkEmailConfigured,
  resolveAuthBaseUrl,
  resolveMagicLinkFromAddress,
  resolveTrustedOrigins,
} from "../lib/auth-env.ts"
import { canStartHeavyCombine } from "../lib/heavy-combine-gate.ts"
import { parseMagicLinkEmail } from "../lib/magic-link-email.ts"
import {
  isApproachingHeavyLimit,
  shouldPromptMagicLink,
} from "../lib/merge-limits.ts"
import {
  resolveVirtualDropIndex,
  virtualListHeightPx,
} from "../lib/virtual-pdf-list.ts"

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${String(expected)}, got ${String(actual)}`
    )
  }
}

assertEqual(parseMagicLinkEmail("  brice@example.com "), "brice@example.com", "trim email")
assertEqual(parseMagicLinkEmail("not-an-email"), null, "reject invalid email")

assertEqual(
  isAuthConfigured({ DATABASE_URL: "postgres://x", BETTER_AUTH_SECRET: "s".repeat(32) }),
  true,
  "auth configured when db + secret exist"
)
assertEqual(isAuthConfigured({}), false, "auth off without secrets")
assertEqual(
  isMagicLinkEmailConfigured({ RESEND_API_KEY: "re_test" }),
  true,
  "email configured when Resend key exists (verified from is default)"
)
assertEqual(
  resolveMagicLinkFromAddress({}),
  "PDF Combine <noreply@onboarding.briceduke.dev>",
  "default from is the verified onboarding domain"
)
assertEqual(
  resolveMagicLinkFromAddress({
    RESEND_FROM_EMAIL: "PDF Combine <hello@onboarding.briceduke.dev>",
  }),
  "PDF Combine <hello@onboarding.briceduke.dev>",
  "RESEND_FROM_EMAIL overrides the default sender"
)

assertEqual(
  resolveAuthBaseUrl({ VERCEL_URL: "pdf-combine-123.vercel.app" }),
  "https://pdf-combine-123.vercel.app",
  "preview uses VERCEL_URL"
)
assertEqual(
  resolveAuthBaseUrl({
    BETTER_AUTH_URL: "https://pdf.briceduke.dev",
    VERCEL_URL: "pdf-combine-123.vercel.app",
  }),
  "https://pdf.briceduke.dev",
  "production URL wins over preview host"
)

const origins = resolveTrustedOrigins({
  VERCEL_URL: "pdf-combine-123.vercel.app",
})
if (!origins.includes("https://pdf.briceduke.dev")) {
  throw new Error("Trusted origins must include the production domain.")
}
if (!origins.includes("https://pdf-combine-123.vercel.app")) {
  throw new Error("Trusted origins must include the current Vercel URL.")
}

assertEqual(shouldPromptMagicLink(false, false), false, "no sign-in UI on client path")
assertEqual(shouldPromptMagicLink(false, true), false, "no sign-in UI on client path even if session")
assertEqual(shouldPromptMagicLink(true, false), true, "prompt only when heavy and unsigned")
assertEqual(shouldPromptMagicLink(true, true), false, "no prompt when already signed in")

assertEqual(
  isApproachingHeavyLimit({ fileCount: 15, totalBytes: 1024 }),
  true,
  "15 files is a soft warning"
)
assertEqual(
  isApproachingHeavyLimit({ fileCount: 2, totalBytes: 1024 }),
  false,
  "tiny jobs have no auth copy"
)
assertEqual(
  isApproachingHeavyLimit({ fileCount: 20, totalBytes: 1024 }),
  false,
  "at threshold is heavy, not approaching"
)

assertEqual(
  canStartHeavyCombine({
    blobEnabled: true,
    authConfigured: true,
    isSignedIn: true,
  }),
  true,
  "heavy combine needs blob + auth env + session"
)
assertEqual(
  canStartHeavyCombine({
    blobEnabled: true,
    authConfigured: true,
    isSignedIn: false,
  }),
  false,
  "unsigned users cannot start workflows"
)

assertEqual(resolveVirtualDropIndex(0, 176, 10), 2, "drag down two rows")
assertEqual(resolveVirtualDropIndex(0, -400, 10), 0, "clamp to start")
assertEqual(virtualListHeightPx(3) < virtualListHeightPx(400), true, "cap tall lists")

console.log("Auth gate: magic link only on heavy jobs; client path stays anonymous.")
