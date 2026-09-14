import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { isAuthConfigured } from "@/lib/auth-env"

export interface AuthUser {
  readonly id: string
  readonly email: string
  readonly name: string
}

/**
 * Read the validated Better Auth session for this request.
 *
 * @returns Signed-in user, or null when missing/unconfigured.
 */
export async function getSessionUser(): Promise<AuthUser | null> {
  if (!isAuthConfigured()) {
    return null
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  })
  const user = session?.user

  if (!user?.id || !user.email) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
  }
}

/**
 * JSON 401 used by Blob upload and Workflow start/download.
 *
 * @returns Unauthorized response.
 */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: "Sign in to upload and merge on the server." },
    { status: 401 }
  )
}

/**
 * JSON 503 when Neon / Better Auth env is missing.
 *
 * @returns Service-unavailable response.
 */
export function authNotConfiguredResponse(): NextResponse {
  return NextResponse.json(
    { error: "Sign-in is not configured. Set DATABASE_URL and BETTER_AUTH_SECRET." },
    { status: 503 }
  )
}
