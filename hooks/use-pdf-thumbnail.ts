"use client"

import * as React from "react"

import { renderPdfThumbnail } from "@/lib/pdf-preview"
import { runThumbnailJob } from "@/lib/thumbnail-queue"

export interface PdfThumbnailState {
  readonly imageUrl: string | null
  readonly pageCount: number | null
  readonly isLoading: boolean
  readonly hasError: boolean
}

export interface UsePdfThumbnailOptions {
  readonly enabled: boolean
}

interface ThumbnailResult {
  readonly imageUrl: string | null
  readonly pageCount: number | null
  readonly hasError: boolean
}

const IDLE_STATE: PdfThumbnailState = {
  imageUrl: null,
  pageCount: null,
  isLoading: false,
  hasError: false,
}

/**
 * Rasterize the first page of a PDF when the row is on screen.
 *
 * @param file - Source PDF.
 * @param options - Skip work when the row is offscreen or thumbs are disabled.
 * @returns Thumbnail object URL, page count, and loading flags.
 */
export function usePdfThumbnail(
  file: File,
  options: UsePdfThumbnailOptions
): PdfThumbnailState {
  const [result, setResult] = React.useState<ThumbnailResult | null>(null)

  React.useEffect(() => {
    if (!options.enabled) {
      return
    }

    let isCancelled = false
    let objectUrl: string | null = null

    void runThumbnailJob(() => renderPdfThumbnail(file)).then(
      ({ blob, pageCount }) => {
        if (isCancelled) {
          return
        }

        objectUrl = URL.createObjectURL(blob)
        setResult({
          imageUrl: objectUrl,
          pageCount,
          hasError: false,
        })
      },
      () => {
        if (!isCancelled) {
          setResult({
            imageUrl: null,
            pageCount: null,
            hasError: true,
          })
        }
      }
    )

    return () => {
      isCancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [file, options.enabled])

  if (!options.enabled) {
    return IDLE_STATE
  }

  if (!result) {
    return {
      imageUrl: null,
      pageCount: null,
      isLoading: true,
      hasError: false,
    }
  }

  return {
    imageUrl: result.imageUrl,
    pageCount: result.pageCount,
    isLoading: false,
    hasError: result.hasError,
  }
}
