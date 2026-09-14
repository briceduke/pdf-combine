import { z } from "zod"

export const magicLinkEmailSchema = z.object({
  email: z.email(),
})

/**
 * Trim and validate a magic-link email address.
 *
 * @param value - Raw input from the sign-in field.
 * @returns Canonical email, or null when invalid.
 */
export function parseMagicLinkEmail(value: string): string | null {
  const parsed = magicLinkEmailSchema.safeParse({ email: value.trim() })
  return parsed.success ? parsed.data.email : null
}
