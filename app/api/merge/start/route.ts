import { NextResponse } from "next/server"
import { start } from "workflow/api"

import {
  authNotConfiguredResponse,
  getSessionUser,
  unauthorizedResponse,
} from "@/lib/auth-session"
import { isAuthConfigured } from "@/lib/auth-env"
import {
  assertMergeJobOwner,
  isHeavyMergeConfigured,
  writeMergeProgress,
} from "@/lib/blob-store"
import {
  assertJobSources,
  heavyMergeStartSchema,
} from "@/lib/heavy-merge-schema"
import { tryCatch } from "@/lib/try-catch"
import { mergePdfsWorkflow } from "@/workflows/merge-pdfs"

export const maxDuration = 60

/**
 * Start a durable Workflow merge after client uploads finish.
 * Requires a Better Auth session that owns the job prefix.
 *
 * @param request - JSON `{ jobId, sources }`.
 * @returns `{ runId, jobId }` for polling.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!isHeavyMergeConfigured()) {
    return NextResponse.json(
      { error: "Heavy merge is not configured. Add BLOB_READ_WRITE_TOKEN." },
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

  const parsed = heavyMergeStartSchema.safeParse(await request.json())

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid merge request." },
      { status: 400 }
    )
  }

  try {
    assertJobSources(parsed.data.jobId, parsed.data.sources)
    await assertMergeJobOwner(parsed.data.jobId, user.id)
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Invalid merge request."
    return NextResponse.json({ error: message }, { status: 400 })
  }

  await writeMergeProgress(parsed.data.jobId, {
    phase: "queued",
    done: 0,
    total: parsed.data.sources.length,
    message: "Starting server merge",
  })

  const started = await tryCatch(() =>
    start(mergePdfsWorkflow, [parsed.data])
  )

  if (started.error) {
    console.error(started.error)
    return NextResponse.json(
      { error: "Could not start the merge workflow." },
      { status: 500 }
    )
  }

  return NextResponse.json({
    runId: started.data.runId,
    jobId: parsed.data.jobId,
  })
}
