"use client"

import * as React from "react"

import { renderPdfThumbnail } from "@/lib/pdf-preview"

export interface PdfThumbnailState {
  readonly imageUrl: string | null
  readonly pageCount: number | null
  readonly isLoading: boolean
  readonly hasError: boolean
}

const INITIAL_STATE: PdfThumbnailState = {
  imageUrl: null,
  pageCount: null,
  isLoading: true,
  hasError: false,
}

/**
 * Rasterize the first page of a PDF for the queue thumbnail.
 *
 * @param file - Source PDF.
 * @returns Thumbnail object URL, page count, and loading flags.
 */
export function usePdfThumbnail(file: File): PdfThumbnailState {
  const [state, setState] = React.useState<PdfThumbnailState>(INITIAL_STATE)

  React.useEffect(() => {
    let isCancelled = false
    let objectUrl: string | null = null

    async function loadThumbnail(): Promise<void> {
      try {
        const { blob, pageCount } = await renderPdfThumbnail(file)

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
  }, [file])

  return state
}
