"use client"

import * as React from "react"
import {
  Alert02Icon,
  CloudUploadIcon,
  Download01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

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
import { mergePdfFiles } from "@/lib/merge-pdfs"
import { createPdfItems, splitPdfFiles, type PdfItem } from "@/lib/pdf-files"
import { cn } from "@/lib/utils"

function downloadPdf(bytes: Uint8Array, filename: string) {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
  const blob = new Blob([buffer], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
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
  const [error, setError] = React.useState<string | null>(null)

  function addFiles(fileList: FileList | File[]) {
    const { accepted, rejected } = splitPdfFiles(Array.from(fileList))

    if (accepted.length > 0) {
      setItems((current) => [...current, ...createPdfItems(accepted)])
      setError(null)
    }

    if (rejected.length > 0) {
      const names = rejected.map((file) => file.name).join(", ")
      const message = `Only PDF files can be combined. Skipped ${names}.`
      setError(message)
      toast.error(message)
    }
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node)) {
      return
    }

    setIsDragging(false)
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    addFiles(event.dataTransfer.files)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (items.length < 2 || isCombining) {
      return
    }

    setIsCombining(true)
    setProgress(0)
    setError(null)

    try {
      const bytes = await mergePdfFiles(
        items.map((item) => item.file),
        (done, total) => {
          setProgress(Math.round((done / total) * 100))
        }
      )

      downloadPdf(bytes, "combined.pdf")
      toast.success(`Combined ${items.length} PDFs.`)
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Could not combine these PDFs."
      setError(message)
      toast.error(message)
    } finally {
      setIsCombining(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Combine PDFs</CardTitle>
          <CardDescription>
            Drop files, reorder them, then download one PDF. Nothing is
            uploaded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
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
                  Files stay in this browser. Press D to toggle dark mode.
                </FieldDescription>
              </Field>
              {items.length > 0 ? (
                <Field>
                  <FieldLabel>
                    Order
                    <Badge variant="secondary">{items.length}</Badge>
                  </FieldLabel>
                  <FieldDescription>
                    Drag the handle to reorder. The top file is first in the
                    combined PDF.
                  </FieldDescription>
                  <SortablePdfList
                    items={items}
                    disabled={isCombining}
                    processing={isCombining}
                    onReorder={setItems}
                    onRemove={(id) => {
                      setItems((current) =>
                        current.filter((item) => item.id !== id)
                      )
                    }}
                  />
                </Field>
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
                  <Progress value={progress} aria-label="Combining PDFs" />
                  <FieldDescription>
                    Combining files… {progress}%
                  </FieldDescription>
                </Field>
              ) : null}
              <Field>
                <ButtonGroup className="w-full *:flex-1">
                  <Button
                    type="submit"
                    disabled={items.length < 2 || isCombining}
                  >
                    {isCombining ? (
                      <Spinner />
                    ) : (
                      <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
                    )}
                    Combine
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={items.length === 0 || isCombining}
                    onClick={() => {
                      setItems([])
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
                    : `Ready to merge ${items.length} files into combined.pdf.`}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        Private by design — merging runs on your device with pdf-lib.
      </FieldDescription>
    </div>
  )
}
