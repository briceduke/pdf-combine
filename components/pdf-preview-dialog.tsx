"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { formatPageCount } from "@/lib/pdf-files"
import { MAX_PREVIEW_PAGES, renderPdfPreviewPages } from "@/lib/pdf-preview"

export interface PdfPreviewDialogProps {
  readonly open: boolean
  readonly title: string
  readonly source: File | Uint8Array | null
  readonly downloadLabel?: string
  readonly onOpenChange: (open: boolean) => void
  readonly onDownload?: () => void
}

interface PreviewImage {
  readonly pageNumber: number
  readonly url: string
}

interface PdfPreviewBodyProps {
  readonly title: string
  readonly source: File | Uint8Array
  readonly downloadLabel: string
  readonly onDownload?: () => void
}

function revokePreviewImages(images: readonly PreviewImage[]): void {
  for (const image of images) {
    URL.revokeObjectURL(image.url)
  }
}

function PdfPreviewBody({
  title,
  source,
  downloadLabel,
  onDownload,
}: PdfPreviewBodyProps) {
  const [images, setImages] = React.useState<readonly PreviewImage[]>([])
  const [pageCount, setPageCount] = React.useState<number | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [hasError, setHasError] = React.useState(false)

  React.useEffect(() => {
    let isCancelled = false
    const created: PreviewImage[] = []

    async function loadPreview(): Promise<void> {
      try {
        const preview = await renderPdfPreviewPages(source)

        if (isCancelled) {
          return
        }

        for (const page of preview.pages) {
          created.push({
            pageNumber: page.pageNumber,
            url: URL.createObjectURL(page.blob),
          })
        }

        setPageCount(preview.pageCount)
        setImages(created)
      } catch {
        if (!isCancelled) {
          setHasError(true)
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadPreview()

    return () => {
      isCancelled = true
      revokePreviewImages(created)
    }
  }, [source])

  const visibleCount = images.length
  const extraCount =
    pageCount != null && pageCount > visibleCount ? pageCount - visibleCount : 0

  return (
    <DialogContent className="flex max-h-[85dvh] flex-col gap-4 overflow-hidden sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="pr-8">{title}</DialogTitle>
        <DialogDescription>
          {pageCount != null
            ? `${formatPageCount(pageCount)} in merge order. Pages stay on this device.`
            : "Rendering pages in this browser. Nothing is uploaded."}
        </DialogDescription>
      </DialogHeader>
      <ScrollArea className="h-[min(52dvh,28rem)]">
        <div className="flex flex-col gap-3 pr-3">
          {isLoading ? (
            <>
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </>
          ) : null}
          {hasError ? (
            <p className="text-sm text-destructive">
              Could not render a preview of this PDF. The file may be too large
              for this device — download it instead of previewing every page.
            </p>
          ) : null}
          {images.map((image) => (
            <figure key={image.pageNumber} className="flex flex-col gap-2">
              {/* Blob URLs from pdfjs cannot be optimized by next/image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt={`Page ${image.pageNumber}`}
                className="w-full rounded-xl bg-muted ring-1 ring-foreground/10"
              />
              <figcaption className="text-xs text-muted-foreground">
                Page {image.pageNumber}
                {pageCount != null ? ` of ${pageCount}` : ""}
              </figcaption>
            </figure>
          ))}
          {extraCount > 0 ? (
            <Badge variant="secondary">
              Showing first {Math.min(visibleCount, MAX_PREVIEW_PAGES)} of{" "}
              {pageCount} pages
            </Badge>
          ) : null}
        </div>
      </ScrollArea>
      {onDownload ? (
        <DialogFooter>
          <Button type="button" onClick={onDownload} disabled={isLoading}>
            {isLoading ? <Spinner /> : null}
            {downloadLabel}
          </Button>
        </DialogFooter>
      ) : null}
    </DialogContent>
  )
}

export function PdfPreviewDialog({
  open,
  title,
  source,
  downloadLabel = "Download",
  onOpenChange,
  onDownload,
}: PdfPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {source ? (
        <PdfPreviewBody
          title={title}
          source={source}
          downloadLabel={downloadLabel}
          onDownload={onDownload}
        />
      ) : null}
    </Dialog>
  )
}
