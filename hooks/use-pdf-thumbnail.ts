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
  const [state, setState] = React.useState<PdfThumbnailState>(
    options.enabled ? { ...IDLE_STATE, isLoading: true } : IDLE_STATE
  )

  React.useEffect(() => {
    if (!options.enabled) {
      setState(IDLE_STATE)
      return
    }

    let isCancelled = false
    let objectUrl: string | null = null

    setState({
      imageUrl: null,
      pageCount: null,
      isLoading: true,
      hasError: false,
    })

    async function loadThumbnail(): Promise<void> {
      try {
        const { blob, pageCount } = await runThumbnailJob(() =>
          renderPdfThumbnail(file)
        )

        if (isCancelled) {
          return
        }

        objectUrl = URL.createObjectURL(blob)
        setState({
          imageUrl: objectUrl,
          pageCount,
          isLoading: false,
          hasError: false,
        })
      } catch {
        if (!isCancelled) {
          setState({
            imageUrl: null,
            pageCount: null,
            isLoading: false,
            hasError: true,
          })
        }
      }
    }

    void loadThumbnail()

    return () => {
      isCancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [file, options.enabled])

  return state
}
