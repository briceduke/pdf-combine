"use client"

import { InformationCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CLIENT_MAX_FILE_COUNT } from "@/lib/merge-limits"

export function HeavyMergeNotice({
  enabled,
  fileCount,
}: {
  readonly enabled: boolean
  readonly fileCount: number
}) {
  if (enabled) {
    return (
      <Alert>
        <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
        <AlertTitle>Temporary upload</AlertTitle>
        <AlertDescription>
          This job is over the on-device limit ({CLIENT_MAX_FILE_COUNT} files or
          32 MB). Files upload to private Vercel Blob, merge on Vercel
          Workflows, then delete after download or within 1 hour. They are not
          kept.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert variant="destructive">
      <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
      <AlertTitle>Too large for this phone</AlertTitle>
      <AlertDescription>
        {fileCount} files would freeze or crash in-browser merge (Samsung / ~395
        files). Heavy merge needs a Blob store — see SPIKE.md. Combine fewer
        files until that is configured.
      </AlertDescription>
    </Alert>
  )
}
