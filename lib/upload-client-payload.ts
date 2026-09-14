import { z } from "zod"

import { HEAVY_MAX_FILE_BYTES } from "@/lib/merge-limits"
import { JOB_ID_PATTERN } from "@/lib/pdf-job"

export const uploadClientPayloadSchema = z.object({
  jobId: z.string().regex(JOB_ID_PATTERN),
  byteSize: z.number().int().nonnegative().max(HEAVY_MAX_FILE_BYTES),
})

export type UploadClientPayload = z.infer<typeof uploadClientPayloadSchema>

/**
 * Parse the Blob `clientPayload` JSON from a heavy-merge upload.
 *
 * @param raw - String from `@vercel/blob/client`.
 * @returns Job id and declared file size.
 */
export function parseUploadClientPayload(raw: string): UploadClientPayload {
  let parsed: unknown = raw

  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("Upload payload must be JSON with jobId and byteSize.")
  }

  const result = uploadClientPayloadSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error("Upload payload is invalid or the file is too large.")
  }

  return result.data
}
