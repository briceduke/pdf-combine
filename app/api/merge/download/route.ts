import { after, NextResponse } from "next/server"

import {
  authNotConfiguredResponse,
  getSessionUser,
  unauthorizedResponse,
} from "@/lib/auth-session"
import { isAuthConfigured } from "@/lib/auth-env"
import {
  assertMergeJobOwner,
  deleteJobBlobs,
  getCombinedPdfStream,
  isHeavyMergeConfigured,
} from "@/lib/blob-store"
import { isJobId } from "@/lib/pdf-job"
import { tryCatch } from "@/lib/try-catch"

export const maxDuration = 60

/**
 * Stream the combined PDF and delete job blobs after the response starts.
 * Requires the same Better Auth user that uploaded the job.
 *
 * @param request - `?jobId=` of a finished merge.
 * @returns `combined.pdf` or an error.
 */
export async function GET(request: Request): Promise<Response> {
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

  const jobId = new URL(request.url).searchParams.get("jobId")

  if (!jobId || !isJobId(jobId)) {
    return NextResponse.json({ error: "Invalid job id." }, { status: 400 })
  }

  const owned = await tryCatch(() => assertMergeJobOwner(jobId, user.id))
  if (owned.error) {
    return NextResponse.json({ error: owned.error.message }, { status: 403 })
  }

  const combined = await getCombinedPdfStream(jobId)

  if (!combined) {
    return NextResponse.json(
      { error: "Combined PDF is not ready or has expired." },
      { status: 404 }
    )
  }

  after(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 15_000)
    })
    await deleteJobBlobs(jobId)
  })

  return new Response(combined.stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="combined.pdf"',
      "Content-Length": String(combined.size),
      "X-Content-Type-Options": "nosniff",
    },
  })
}
