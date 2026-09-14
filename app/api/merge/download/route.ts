import { after, NextResponse } from "next/server"

import {
  deleteJobBlobs,
  getCombinedPdfStream,
  isHeavyMergeConfigured,
} from "@/lib/blob-store"
import { isJobId } from "@/lib/pdf-job"

export const maxDuration = 60

/**
 * Stream the combined PDF and delete job blobs after the response starts.
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

  const jobId = new URL(request.url).searchParams.get("jobId")

  if (!jobId || !isJobId(jobId)) {
    return NextResponse.json({ error: "Invalid job id." }, { status: 400 })
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
