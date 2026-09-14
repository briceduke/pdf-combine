"use client"

import * as React from "react"
import { Mail01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"
import { parseMagicLinkEmail } from "@/lib/magic-link-email"
import { tryCatch } from "@/lib/try-catch"

export function MagicLinkForm({
  emailConfigured,
}: {
  readonly emailConfigured: boolean
}) {
  const [email, setEmail] = React.useState("")
  const [isSending, setIsSending] = React.useState(false)
  const [sentTo, setSentTo] = React.useState<string | null>(null)
  const [fieldError, setFieldError] = React.useState<string | null>(null)
  const emailId = React.useId()

  async function onSubmitForm(
    event: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault()
    const parsed = parseMagicLinkEmail(email)

    if (!parsed) {
      setFieldError("Enter a valid email address.")
      return
    }

    setFieldError(null)
    setIsSending(true)

    const result = await tryCatch(async () => {
      const response = await authClient.signIn.magicLink({
        email: parsed,
        callbackURL: "/",
        errorCallbackURL: "/?authError=1",
      })

      if (response.error) {
        throw new Error(response.error.message || "Could not send the sign-in link.")
      }
    })

    setIsSending(false)

    if (result.error) {
      const message = result.error.message
      setFieldError(message)
      toast.error(message)
      return
    }

    setSentTo(parsed)
    toast.success("Check your email for a sign-in link.")
  }

  if (sentTo) {
    return (
      <Alert>
        <HugeiconsIcon icon={Mail01Icon} strokeWidth={2} />
        <AlertTitle>Check your email</AlertTitle>
        <AlertDescription>
          We sent a sign-in link to {sentTo}. It expires in 10 minutes. You can
          keep this tab open, then come back after you click the link.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <form onSubmit={(event) => void onSubmitForm(event)}>
      <FieldGroup className="gap-4">
        <Field data-invalid={fieldError ? true : undefined}>
          <FieldLabel htmlFor={emailId}>Email</FieldLabel>
          <Input
            id={emailId}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            disabled={isSending}
            placeholder="you@example.com"
            onChange={(event) => {
              setEmail(event.target.value)
              setFieldError(null)
            }}
          />
          {fieldError ? <FieldError>{fieldError}</FieldError> : null}
          <FieldDescription>
            {emailConfigured
              ? "We’ll email a one-time link. No password. Small on-device merges do not need this."
              : "Resend is not wired yet. Locally the magic link is printed in the server log."}
          </FieldDescription>
        </Field>
        <Button type="submit" className="w-full" disabled={isSending}>
          {isSending ? <Spinner /> : <HugeiconsIcon icon={Mail01Icon} strokeWidth={2} />}
          Email sign-in link
        </Button>
      </FieldGroup>
    </form>
  )
}
