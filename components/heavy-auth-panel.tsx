"use client"

import * as React from "react"

import { MagicLinkForm } from "@/components/magic-link-form"
import { SessionStatus } from "@/components/session-status"
import { FieldDescription } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"

export interface HeavyAuthSession {
  readonly isSignedIn: boolean
  readonly isPending: boolean
}

/**
 * Magic-link prompt for heavy jobs only. Do not mount on the light path.
 */
export function HeavyAuthPanel({
  emailConfigured,
  onSessionChange,
}: {
  readonly emailConfigured: boolean
  readonly onSessionChange: (session: HeavyAuthSession) => void
}) {
  const { data, isPending } = authClient.useSession()
  const email = data?.user?.email ?? null
  const isSignedIn = Boolean(email)

  React.useEffect(() => {
    onSessionChange({ isSignedIn, isPending })
  }, [isPending, isSignedIn, onSessionChange])

  if (isPending) {
    return (
      <FieldDescription className="flex items-center gap-2">
        <Spinner />
        Checking sign-in…
      </FieldDescription>
    )
  }

  if (isSignedIn && email) {
    return <SessionStatus email={email} />
  }

  return <MagicLinkForm emailConfigured={emailConfigured} />
}
