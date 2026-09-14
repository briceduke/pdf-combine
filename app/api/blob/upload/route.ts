import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { NextResponse } from "next/server"

import {
  authNotConfiguredResponse,
  getSessionUser,
  unauthorizedResponse,
} from "@/lib/auth-session"
import { isAuthConfigured } from "@/lib/auth-env"
import { claimMergeJobOwner, isHeavyMergeConfigured } from "@/lib/blob-store"
import { HEAVY_MAX_FILE_BYTES } from "@/lib/merge-limits"
import { isJobId } from "@/lib/pdf-job"
import { tryCatch } from "@/lib/try-catch"
import { parseUploadClientPayload } from "@/lib/upload-client-payload"

export const maxDuration = 60

function assertUploadPath(pathname: string, jobId: string): void {
  const prefix = `jobs/${jobId}/sources/`

  if (!isJobId(jobId) || !pathname.startsWith(prefix) || !pathname.endsWith(".pdf")) {
    throw new Error("Uploads must be PDFs under this merge job.")
  }
}

/**
 * Issue short-lived Blob client tokens for batched PDF uploads.
 * Requires a Better Auth session. Client-only small merges never hit this.
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

  if (!isAuthConfigured()) {
    return authNotConfiguredResponse()
  }

  const user = await getSessionUser()
  if (!user) {
    return unauthorizedResponse()
  }

  const body = (await request.json()) as HandleUploadBody
  const result = await tryCatch(() =>
    handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = parseUploadClientPayload(clientPayload ?? "")
        assertUploadPath(pathname, payload.jobId)
        await claimMergeJobOwner(payload.jobId, user.id)

        return {
          allowedContentTypes: ["application/pdf", "application/octet-stream"],
          addRandomSuffix: true,
          maximumSizeInBytes: HEAVY_MAX_FILE_BYTES,
          validUntil: Date.now() + 60 * 60 * 1000,
          tokenPayload: JSON.stringify({
            jobId: payload.jobId,
            userId: user.id,
          }),
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
