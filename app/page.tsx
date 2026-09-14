import { Suspense } from "react"
import Link from "next/link"
import { Pdf01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { PdfCombineForm } from "@/components/pdf-combine-form"

export default function Page() {
  return (
    <div className="flex h-dvh flex-col overflow-y-auto overscroll-none bg-muted">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-6 md:min-h-full md:justify-center md:py-10">
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
        <Suspense fallback={null}>
          <PdfCombineForm />
        </Suspense>
      </div>
    </div>
  )
}
