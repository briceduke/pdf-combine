"use client"

import { Pdf01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Skeleton } from "@/components/ui/skeleton"
import type { PdfThumbnailState } from "@/hooks/use-pdf-thumbnail"

export function PdfThumbnail({
  thumbnail,
}: {
  readonly thumbnail: PdfThumbnailState
}) {
  if (thumbnail.isLoading) {
    return <Skeleton className="size-full rounded-xl" />
  }

  if (thumbnail.hasError || !thumbnail.imageUrl) {
    return <HugeiconsIcon icon={Pdf01Icon} strokeWidth={2} />
  }

  return (
    // Blob URLs from pdfjs cannot be optimized by next/image.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={thumbnail.imageUrl}
      alt=""
      width={64}
      height={64}
      className="size-full object-cover"
    />
  )
}
