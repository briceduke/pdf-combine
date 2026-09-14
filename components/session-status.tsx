"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { FieldDescription } from "@/components/ui/field"
import { authClient } from "@/lib/auth-client"
import { tryCatch } from "@/lib/try-catch"

export function SessionStatus({
  email,
}: {
  readonly email: string
}) {
  const [isSigningOut, setIsSigningOut] = React.useState(false)

  async function onSignOutClick(): Promise<void> {
    setIsSigningOut(true)
    const result = await tryCatch(() => authClient.signOut())
    setIsSigningOut(false)

    if (result.error) {
      toast.error(result.error.message)
      return
    }

    toast.success("Signed out.")
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <FieldDescription className="m-0 truncate">
        Signed in as {email}
      </FieldDescription>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isSigningOut}
        onClick={() => {
          void onSignOutClick()
        }}
      >
        Sign out
      </Button>
    </div>
  )
}
