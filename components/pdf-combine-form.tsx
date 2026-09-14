"use client"

import * as React from "react"
import {
  Alert02Icon,
  CloudUploadIcon,
  Download01Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

import { HeavyMergeNotice } from "@/components/heavy-merge-notice"
import { PdfPreviewDialog } from "@/components/pdf-preview-dialog"
import { SortablePdfList } from "@/components/sortable-pdf-list"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { downloadPdfBytes } from "@/lib/download-pdf"
import {
  downloadHeavyMerge,
  fetchMergeHealth,
  runHeavyMerge,
} from "@/lib/heavy-merge-client"
import { decideMergePath, describeMergeError, measureMergeJob } from "@/lib/merge-limits"
import { mergePdfFiles } from "@/lib/merge-pdfs"
import { createPdfItems, splitPdfFiles, type PdfItem } from "@/lib/pdf-files"
import {
  heavyProgressPercent,
  type HeavyMergeProgress,
} from "@/lib/pdf-job"
import { tryCatch } from "@/lib/try-catch"
import { cn } from "@/lib/utils"

interface FilePreview {
  readonly kind: "file"
  readonly item: PdfItem
}

interface MergedPreview {
  readonly kind: "merged"
  readonly bytes: Uint8Array
}

type ActivePreview = FilePreview | MergedPreview | null

function readSpikeHeavyFlag(): boolean {
  return new URLSearchParams(window.location.search).has("spikeHeavy")
}

export function PdfCombineForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const inputId = React.useId()
  const [items, setItems] = React.useState<PdfItem[]>([])
  const [isDragging, setIsDragging] = React.useState(false)
  const [isCombining, setIsCombining] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [progressLabel, setProgressLabel] = React.useState("Combining files…")
  const [error, setError] = React.useState<string | null>(null)
  const [preview, setPreview] = React.useState<ActivePreview>(null)
  const [mergedBytes, setMergedBytes] = React.useState<Uint8Array | null>(null)
  const [heavyEnabled, setHeavyEnabled] = React.useState(false)
  const [forceHeavy, setForceHeavy] = React.useState(false)
  const [heavyJobId, setHeavyJobId] = React.useState<string | null>(null)

  const files = items.map((item) => item.file)
  const decision = decideMergePath(measureMergeJob(files), forceHeavy)
  const isHeavy = decision.path === "heavy"

  React.useEffect(() => {
    setForceHeavy(readSpikeHeavyFlag())
    void fetchMergeHealth().then((health) => {
      setHeavyEnabled(health.enabled)
    })
  }, [])

  function updateItems(
    updater: PdfItem[] | ((current: PdfItem[]) => PdfItem[])
  ): void {
    setItems(updater)
    setMergedBytes(null)
    setHeavyJobId(null)
  }

  function addFiles(fileList: FileList | File[]): void {
    const { accepted, rejected } = splitPdfFiles(Array.from(fileList))

    if (accepted.length > 0) {
      updateItems((current) => [...current, ...createPdfItems(accepted)])
      setError(null)
    }

    if (rejected.length > 0) {
      const names = rejected.map((file) => file.name).join(", ")
      const message = `Only PDF files can be combined. Skipped ${names}.`
      setError(message)
      toast.error(message)
    }
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>): void {
    if (event.currentTarget.contains(event.relatedTarget as Node)) {
      return
    }

    setIsDragging(false)
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    setIsDragging(false)
    addFiles(event.dataTransfer.files)
  }

  async function combineOnDevice(): Promise<Uint8Array> {
    if (mergedBytes) {
      return mergedBytes
    }

    const bytes = await mergePdfFiles(files, (done, total) => {
      setProgress(Math.round((done / total) * 100))
      setProgressLabel(`Combining files… ${done} of ${total}`)
    })

    setMergedBytes(bytes)
    return bytes
  }

  async function combineOnServer(): Promise<void> {
    const result = await runHeavyMerge(files, (next: HeavyMergeProgress) => {
      setProgress(heavyProgressPercent(next))
      setProgressLabel(next.message)
    })

    setHeavyJobId(result.jobId)
    downloadHeavyMerge(result.jobId)
    toast.success(`Combined ${items.length} PDFs on the server.`)
  }

  async function runCombine(mode: "download" | "preview"): Promise<void> {
    if (items.length < 2 || isCombining) {
      return
    }

    if (isHeavy && !heavyEnabled) {
      const message = decision.reason
      setError(message)
      toast.error(message)
      return
    }

    setIsCombining(true)
    setProgress(mergedBytes && !isHeavy ? 100 : 0)
    setProgressLabel(isHeavy ? "Starting heavy merge…" : "Combining files…")
    setError(null)

    const result = await tryCatch(async () => {
      if (isHeavy) {
        if (mode === "preview") {
          throw new Error(
            "Heavy merge skips in-browser preview. Combine to download combined.pdf."
          )
        }

        await combineOnServer()
        return
      }

      const bytes = await combineOnDevice()

      if (mode === "preview") {
        setPreview({ kind: "merged", bytes })
        return
      }

      downloadPdfBytes(bytes, "combined.pdf")
      toast.success(`Combined ${items.length} PDFs.`)
    })

    if (result.error) {
      const message = describeMergeError(result.error)
      setError(message)
      toast.error(message)
    }

    setIsCombining(false)
  }

  const previewSource =
    preview?.kind === "file"
      ? preview.item.file
      : preview?.kind === "merged"
        ? preview.bytes
        : null

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Combine PDFs</CardTitle>
          <CardDescription>
            Drop files, preview pages, reorder them, then download one PDF.
            Small jobs stay on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void runCombine("download")
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={inputId} className="sr-only">
                  PDF files
                </FieldLabel>
                <Empty
                  className={cn(
                    "border border-dashed transition-colors",
                    isDragging && "border-primary bg-accent"
                  )}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <HugeiconsIcon icon={CloudUploadIcon} strokeWidth={2} />
                    </EmptyMedia>
                    <EmptyTitle>
                      {items.length > 0 ? "Add more PDFs" : "Drop PDFs here"}
                    </EmptyTitle>
                    <EmptyDescription>
                      Drag and drop PDF files, or choose them from your device.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button variant="outline" size="sm" asChild>
                      <label htmlFor={inputId}>Choose PDFs</label>
                    </Button>
                  </EmptyContent>
                </Empty>
                <Input
                  id={inputId}
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  className="sr-only"
                  disabled={isCombining}
                  onChange={(event) => {
                    if (event.target.files) {
                      addFiles(event.target.files)
                    }
                    event.target.value = ""
                  }}
                />
                <FieldDescription>
                  Files stay in this browser unless a job is over 20 files or 32
                  MB. Press D to toggle dark mode.
                </FieldDescription>
              </Field>
              {items.length > 0 ? (
                <Field>
                  <FieldLabel>
                    Order
                    <Badge variant="secondary">{items.length}</Badge>
                    {isHeavy ? (
                      <Badge variant="outline">Heavy</Badge>
                    ) : (
                      <Badge variant="outline">On device</Badge>
                    )}
                  </FieldLabel>
                  <FieldDescription>
                    {isHeavy
                      ? "Thumbnails are skipped for large jobs. Drag the handle to reorder."
                      : "Tap a thumbnail to preview pages. Drag the handle to reorder — the top file is first."}
                  </FieldDescription>
                  <SortablePdfList
                    items={items}
                    disabled={isCombining}
                    processing={isCombining}
                    skipThumbs={isHeavy}
                    onPreview={(item) => {
                      setPreview({ kind: "file", item })
                    }}
                    onReorder={updateItems}
                    onRemove={(id) => {
                      updateItems((current) =>
                        current.filter((item) => item.id !== id)
                      )
                    }}
                  />
                </Field>
              ) : null}
              {isHeavy ? (
                <HeavyMergeNotice
                  enabled={heavyEnabled}
                  fileCount={items.length}
                />
              ) : null}
              {error ? (
                <Alert variant="destructive">
                  <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
                  <AlertTitle>Could not combine</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              {isCombining ? (
                <Field>
                  <Progress
                    value={progress}
                    aria-label="Combining PDFs"
                  />
                  <FieldDescription>
                    {progressLabel} {progress}%
                  </FieldDescription>
                </Field>
              ) : null}
              <Field>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    items.length < 2 ||
                    isCombining ||
                    (isHeavy && !heavyEnabled)
                  }
                >
                  {isCombining ? (
                    <Spinner />
                  ) : (
                    <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
                  )}
                  Combine
                </Button>
                <ButtonGroup className="w-full *:flex-1">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={items.length < 2 || isCombining || isHeavy}
                    onClick={() => {
                      void runCombine("preview")
                    }}
                  >
                    <HugeiconsIcon icon={ViewIcon} strokeWidth={2} />
                    Preview
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={items.length === 0 || isCombining}
                    onClick={() => {
                      updateItems([])
                      setPreview(null)
                      setMergedBytes(null)
                      setHeavyJobId(null)
                      setError(null)
                      setProgress(0)
                    }}
                  >
                    Clear
                  </Button>
                </ButtonGroup>
                <FieldDescription>
                  {items.length < 2
                    ? "Add at least two PDFs to combine."
                    : isHeavy
                      ? decision.reason
                      : `Ready to merge ${items.length} files into combined.pdf on this device.`}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        {heavyJobId
          ? "Heavy merge uploaded files only for this job, then deleted them."
          : "Private by design — small merges run on your device with pdf-lib."}
      </FieldDescription>
      <PdfPreviewDialog
        open={preview !== null}
        title={
          preview?.kind === "file" ? preview.item.file.name : "combined.pdf"
        }
        source={previewSource}
        downloadLabel="Download combined.pdf"
        onOpenChange={(open) => {
          if (!open) {
            setPreview(null)
          }
        }}
        onDownload={
          preview?.kind === "merged"
            ? () => {
                downloadPdfBytes(preview.bytes, "combined.pdf")
                toast.success(`Combined ${items.length} PDFs.`)
                setPreview(null)
              }
            : undefined
        }
      />
    </div>
  )
}
