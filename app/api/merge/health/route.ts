import { NextResponse } from "next/server"

import { isHeavyMergeConfigured } from "@/lib/blob-store"

/**
 * Report whether heavy merge can run (Blob token present).
 *
 * @returns JSON `{ enabled: boolean }`.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ enabled: isHeavyMergeConfigured() })
}
