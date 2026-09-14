"use client"

import { InformationCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CLIENT_MAX_FILE_COUNT } from "@/lib/merge-limits"

export function HeavyMergeNotice({
  blobEnabled,
  authConfigured,
  isSignedIn,
  fileCount,
}: {
  readonly blobEnabled: boolean
  readonly authConfigured: boolean
  readonly isSignedIn: boolean
  readonly fileCount: number
}) {
  if (!blobEnabled) {
    return (
      <Alert variant="destructive">
        <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
        <AlertTitle>Too large for this phone</AlertTitle>
        <AlertDescription>
          {fileCount} files would freeze or crash in-browser merge (Samsung / ~395
          files). Heavy merge needs a Blob store. Combine fewer files until that
          is configured.
        </AlertDescription>
      </Alert>
    )
  }

  if (!authConfigured) {
    return (
      <Alert variant="destructive">
        <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
        <AlertTitle>Sign-in is not wired</AlertTitle>
        <AlertDescription>
          Large jobs upload through Vercel Blob and need Better Auth. Set
          DATABASE_URL (Neon). RESEND_API_KEY and BETTER_AUTH_SECRET are already
          on Vercel — see README.
        </AlertDescription>
      </Alert>
    )
  }

  if (!isSignedIn) {
    return (
      <Alert>
        <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
        <AlertTitle>Sign in to upload</AlertTitle>
        <AlertDescription>
          This job is over the on-device limit ({CLIENT_MAX_FILE_COUNT} files or
          32 MB). Email a magic link to upload privately, merge on Vercel
          Workflows, then delete after download or within 1 hour.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert>
      <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
      <AlertTitle>Temporary upload</AlertTitle>
      <AlertDescription>
        This job is over the on-device limit ({CLIENT_MAX_FILE_COUNT} files or 32
        MB). Files upload to private Vercel Blob, merge on Vercel Workflows, then
        delete after download or within 1 hour. They are not kept.
      </AlertDescription>
    </Alert>
  )
}
