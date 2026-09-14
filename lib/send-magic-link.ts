import { Resend } from "resend"

import {
  isMagicLinkEmailConfigured,
  resolveMagicLinkFromAddress,
} from "@/lib/auth-env"

interface MagicLinkMail {
  readonly email: string
  readonly url: string
}

function buildMagicLinkHtml(url: string): string {
  return [
    "<p>Sign in to PDF Combine to upload and merge large jobs.</p>",
    `<p><a href="${url}">Sign in</a></p>`,
    "<p>This link expires in 10 minutes. If you did not request it, ignore this email.</p>",
  ].join("")
}

/**
 * Send a Better Auth magic link through Resend.
 *
 * Locally, logs the URL when `RESEND_API_KEY` is unset so you can sign in
 * without a mailbox.
 *
 * @param input - Recipient and Better Auth verify URL.
 */
export async function sendMagicLinkEmail(input: MagicLinkMail): Promise<void> {
  if (!isMagicLinkEmailConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is required to send sign-in links.")
    }

    console.info(`[auth] Magic link for ${input.email}: ${input.url}`)
    return
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const sent = await resend.emails.send({
    from: resolveMagicLinkFromAddress(),
    to: input.email,
    subject: "Sign in to PDF Combine",
    html: buildMagicLinkHtml(input.url),
    text: `Sign in to PDF Combine: ${input.url}\nThis link expires in 10 minutes.`,
  })

  if (sent.error) {
    throw new Error(sent.error.message)
  }
}
