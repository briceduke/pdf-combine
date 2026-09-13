"use client"

import Link from "next/link"
import { Pdf01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { PdfCombineForm } from "@/components/pdf-combine-form"

export default function Page() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <Link
          href="/"
          className="flex items-center gap-2 self-center font-medium"
        >
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <HugeiconsIcon
              icon={Pdf01Icon}
              strokeWidth={2}
              className="size-4"
            />
          </div>
          PDF Combine
        </Link>
        <PdfCombineForm />
      </div>
    </div>
  )
}
