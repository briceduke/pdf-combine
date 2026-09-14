import { z } from "zod"

import { HEAVY_MAX_FILE_COUNT } from "@/lib/merge-limits"
import { JOB_ID_PATTERN, type UploadedPdfSource } from "@/lib/pdf-job"

export const uploadedPdfSourceSchema = z.object({
  pathname: z.string().min(1),
  fileName: z.string().min(1),
})

export const heavyMergeStartSchema = z.object({
  jobId: z.string().regex(JOB_ID_PATTERN),
  sources: z.array(uploadedPdfSourceSchema).min(2).max(HEAVY_MAX_FILE_COUNT),
})

export type HeavyMergeStartBody = z.infer<typeof heavyMergeStartSchema>

/**
 * Reject source pathnames that do not belong to this job.
 *
 * @param jobId - UUID for the combine run.
 * @param sources - Client-reported blob pathnames.
 * @returns Validated sources.
 */
export function assertJobSources(
  jobId: string,
  sources: readonly UploadedPdfSource[]
): readonly UploadedPdfSource[] {
  const prefix = `jobs/${jobId}/sources/`

  for (const source of sources) {
    if (!source.pathname.startsWith(prefix)) {
      throw new Error("An uploaded file is not part of this merge job.")
    }
  }

  return sources
}
