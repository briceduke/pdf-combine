import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { NextResponse } from "next/server"

import { isHeavyMergeConfigured } from "@/lib/blob-store"
import { isJobId } from "@/lib/pdf-job"
import { tryCatch } from "@/lib/try-catch"

export const maxDuration = 60

function assertUploadPath(pathname: string, jobId: string): void {
  const prefix = `jobs/${jobId}/sources/`

  if (!isJobId(jobId) || !pathname.startsWith(prefix) || !pathname.endsWith(".pdf")) {
    throw new Error("Uploads must be PDFs under this merge job.")
  }
}

/**
 * Issue short-lived Blob client tokens for batched PDF uploads.
 *
 * @param request - Blob SDK handshake body.
 * @returns Token JSON for `@vercel/blob/client`.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!isHeavyMergeConfigured()) {
    return NextResponse.json(
      { error: "Heavy merge is not configured. Add BLOB_READ_WRITE_TOKEN." },
      { status: 503 }
    )
  }

  const body = (await request.json()) as HandleUploadBody
  const result = await tryCatch(() =>
    handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const jobId = clientPayload ?? ""
        assertUploadPath(pathname, jobId)

        return {
          allowedContentTypes: ["application/pdf", "application/octet-stream"],
          addRandomSuffix: true,
          validUntil: Date.now() + 60 * 60 * 1000,
          tokenPayload: JSON.stringify({ jobId }),
        }
      },
      onUploadCompleted: async () => {
        // Local callbacks need a public URL; merge starts from client-reported pathnames.
      },
    })
  )

  if (result.error) {
    console.error(result.error)
    return NextResponse.json({ error: result.error.message }, { status: 400 })
  }

  return NextResponse.json(result.data)
}
