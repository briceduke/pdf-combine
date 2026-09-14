import { NextResponse } from "next/server"

import {
  isAuthConfigured,
  isMagicLinkEmailConfigured,
} from "@/lib/auth-env"
import { isHeavyMergeConfigured } from "@/lib/blob-store"

export interface MergeHealth {
  readonly enabled: boolean
  readonly authConfigured: boolean
  readonly emailConfigured: boolean
}

/**
 * Report whether heavy merge and Better Auth env are wired.
 *
 * @returns JSON flags. Session is checked on the client via Better Auth.
 */
export async function GET(): Promise<NextResponse<MergeHealth>> {
  return NextResponse.json({
    enabled: isHeavyMergeConfigured(),
    authConfigured: isAuthConfigured(),
    emailConfigured: isMagicLinkEmailConfigured(),
  })
}
