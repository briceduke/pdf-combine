import { NextResponse } from "next/server"
import { getRun } from "workflow/api"

import {
  authNotConfiguredResponse,
  getSessionUser,
  unauthorizedResponse,
} from "@/lib/auth-session"
import { isAuthConfigured } from "@/lib/auth-env"
import {
  assertMergeJobOwner,
  isHeavyMergeConfigured,
  readMergeProgress,
} from "@/lib/blob-store"
import { isJobId } from "@/lib/pdf-job"
import { tryCatch } from "@/lib/try-catch"
import type { HeavyMergeResult } from "@/lib/pdf-job"

export const maxDuration = 30

interface RouteParams {
  readonly params: Promise<{ runId: string }>
}

/**
 * Poll workflow status plus Blob progress JSON for a heavy merge.
 * Requires a session that owns `jobId`.
 *
 * @param request - `?jobId=` for progress and ownership.
 * @param context - Dynamic `runId`.
 * @returns Status, progress, and result when complete.
 */
export async function GET(
  request: Request,
  context: RouteParams
): Promise<NextResponse> {
  if (!isHeavyMergeConfigured()) {
    return NextResponse.json(
      { error: "Heavy merge is not configured." },
      { status: 503 }
    )
  }

  if (!isAuthConfigured()) {
    return authNotConfiguredResponse()
  }

  const user = await getSessionUser()
  if (!user) {
    return unauthorizedResponse()
  }

  const { runId } = await context.params
  const jobId = new URL(request.url).searchParams.get("jobId")

  if (!jobId || !isJobId(jobId)) {
    return NextResponse.json({ error: "Invalid job id." }, { status: 400 })
  }

  const owned = await tryCatch(() => assertMergeJobOwner(jobId, user.id))
  if (owned.error) {
    return NextResponse.json({ error: owned.error.message }, { status: 403 })
  }

  const run = getRun<HeavyMergeResult>(runId)

  if (!(await run.exists)) {
    return NextResponse.json({ error: "Merge run not found." }, { status: 404 })
  }

  const status = await run.status
  const progress = await readMergeProgress(jobId)

  if (status === "completed") {
    const completed = await tryCatch(async () => run.returnValue)

    if (completed.error) {
      console.error(completed.error)
      return NextResponse.json(
        { status, progress, error: completed.error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status,
      progress,
      result: completed.data,
    })
  }

  if (status === "failed" || status === "cancelled") {
    return NextResponse.json({
      status,
      progress,
      error:
        status === "cancelled"
          ? "Merge was cancelled."
          : "Server merge failed. Try fewer files or check Workflow logs.",
    })
  }

  return NextResponse.json({ status, progress })
}
