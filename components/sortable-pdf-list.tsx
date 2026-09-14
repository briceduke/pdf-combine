"use client"

import * as React from "react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Cancel01Icon, DragDropVerticalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { PdfThumbnail } from "@/components/pdf-thumbnail"
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@/components/ui/attachment"
import { useInViewport } from "@/hooks/use-in-viewport"
import {
  usePdfThumbnail,
  type PdfThumbnailState,
} from "@/hooks/use-pdf-thumbnail"
import { formatFileSize, formatPageCount, type PdfItem } from "@/lib/pdf-files"
import { cn } from "@/lib/utils"
import {
  PDF_LIST_OVERSCAN,
  PDF_LIST_ROW_PX,
  resolveVirtualDropIndex,
  virtualListHeightPx,
} from "@/lib/virtual-pdf-list"

const DRAG_DISTANCE_PX = 8

const IDLE_THUMBNAIL: PdfThumbnailState = {
  imageUrl: null,
  pageCount: null,
  isLoading: false,
  hasError: false,
}

const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args)
}

function setDocumentDragging(isDragging: boolean): void {
  document.documentElement.classList.toggle("is-dragging", isDragging)
}

function PdfRowBody({
  item,
  disabled,
  processing,
  isDragging,
  pageLabel,
  thumbnail,
  dragHandleProps,
  onPreview,
  onRemove,
}: {
  readonly item: PdfItem
  readonly disabled?: boolean
  readonly processing?: boolean
  readonly isDragging?: boolean
  readonly pageLabel: string
  readonly thumbnail: PdfThumbnailState
  readonly dragHandleProps?: React.ComponentProps<typeof AttachmentAction>
  readonly onPreview?: (item: PdfItem) => void
  readonly onRemove?: (id: string) => void
}) {
  return (
    <Attachment
      state={processing ? "processing" : "done"}
      className={cn("w-full max-w-none", isDragging && "opacity-50")}
    >
      <AttachmentMedia variant="image" className="size-16">
        <PdfThumbnail thumbnail={thumbnail} />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{item.file.name}</AttachmentTitle>
        <AttachmentDescription>
          {pageLabel} · {formatFileSize(item.file.size)}
        </AttachmentDescription>
      </AttachmentContent>
      <AttachmentTrigger
        disabled={disabled || !onPreview}
        aria-label={`Preview ${item.file.name}`}
        onClick={() => onPreview?.(item)}
      />
      <AttachmentActions>
        <AttachmentAction
          {...dragHandleProps}
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          aria-label={`Drag to reorder ${item.file.name}`}
          className="touch-none"
          style={{ touchAction: "none" }}
        >
          <HugeiconsIcon icon={DragDropVerticalIcon} strokeWidth={2} />
        </AttachmentAction>
        <AttachmentAction
          type="button"
          variant="ghost"
          disabled={disabled || !onRemove}
          aria-label={`Remove ${item.file.name}`}
          onClick={() => onRemove?.(item.id)}
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
        </AttachmentAction>
      </AttachmentActions>
    </Attachment>
  )
}

function SortablePdfItem({
  item,
  disabled,
  processing,
  skipThumbs,
  style,
  onPreview,
  onRemove,
}: {
  readonly item: PdfItem
  readonly disabled?: boolean
  readonly processing?: boolean
  readonly skipThumbs: boolean
  readonly style: React.CSSProperties
  readonly onPreview: (item: PdfItem) => void
  readonly onRemove: (id: string) => void
}) {
  const itemRef = React.useRef<HTMLDivElement>(null)
  const isVisible = useInViewport(itemRef)
  const [hasBeenVisible, setHasBeenVisible] = React.useState(false)

  if (isVisible && !hasBeenVisible) {
    setHasBeenVisible(true)
  }

  const thumbnail = usePdfThumbnail(item.file, {
    enabled: !skipThumbs && hasBeenVisible,
  })
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled,
  })

  return (
    <div
      ref={(node) => {
        setNodeRef(node)
        itemRef.current = node
      }}
      role="listitem"
      className={cn("absolute top-0 left-0 w-full", isDragging && "z-10")}
      style={{
        ...style,
        height: PDF_LIST_ROW_PX,
        transform: [style.transform, CSS.Transform.toString(transform)]
          .filter(Boolean)
          .join(" "),
        transition,
      }}
    >
      <PdfRowBody
        item={item}
        disabled={disabled}
        processing={processing}
        isDragging={isDragging}
        pageLabel={
          thumbnail.pageCount != null
            ? formatPageCount(thumbnail.pageCount)
            : "PDF"
        }
        thumbnail={thumbnail}
        dragHandleProps={{ ...attributes, ...listeners }}
        onPreview={onPreview}
        onRemove={onRemove}
      />
    </div>
  )
}

const MemoSortablePdfItem = React.memo(SortablePdfItem)

export function SortablePdfList({
  items,
  disabled,
  processing,
  skipThumbs = false,
  onPreview,
  onReorder,
  onRemove,
}: {
  readonly items: PdfItem[]
  readonly disabled?: boolean
  readonly processing?: boolean
  readonly skipThumbs?: boolean
  readonly onPreview: (item: PdfItem) => void
  readonly onReorder: (items: PdfItem[]) => void
  readonly onRemove: (id: string) => void
}) {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const itemIds = React.useMemo(() => items.map((item) => item.id), [items])
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: DRAG_DISTANCE_PX },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { distance: DRAG_DISTANCE_PX },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => PDF_LIST_ROW_PX,
    overscan: PDF_LIST_OVERSCAN,
  })
  const activeItem = items.find((item) => item.id === activeId) ?? null

  function handleDragEnd(event: DragEndEvent): void {
    setDocumentDragging(false)
    setActiveId(null)

    const oldIndex = items.findIndex((item) => item.id === event.active.id)
    if (oldIndex < 0) {
      return
    }

    const newIndex = resolveVirtualDropIndex(
      oldIndex,
      event.delta.y,
      items.length
    )
    if (newIndex === oldIndex) {
      return
    }

    onReorder(arrayMove(items, oldIndex, newIndex))
  }

  return (
    <DndContext
      collisionDetection={collisionDetection}
      modifiers={[restrictToVerticalAxis]}
      sensors={sensors}
      onDragStart={(event) => {
        setDocumentDragging(true)
        setActiveId(String(event.active.id))
      }}
      onDragCancel={() => {
        setDocumentDragging(false)
        setActiveId(null)
      }}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div
          ref={parentRef}
          className="touch-pan-y overflow-y-auto"
          role="list"
          aria-label="PDF order"
          style={{ height: virtualListHeightPx(items.length) }}
        >
          <div
            className="relative w-full"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = items[virtualRow.index]
              return (
                <MemoSortablePdfItem
                  key={item.id}
                  item={item}
                  disabled={disabled}
                  processing={processing}
                  skipThumbs={skipThumbs}
                  onPreview={onPreview}
                  onRemove={onRemove}
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                />
              )
            })}
          </div>
        </div>
      </SortableContext>
      <DragOverlay>
        {activeItem ? (
          <PdfRowBody
            item={activeItem}
            processing={processing}
            isDragging
            pageLabel="PDF"
            thumbnail={IDLE_THUMBNAIL}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
