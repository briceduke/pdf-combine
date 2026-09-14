"use client"

import {
  DndContext,
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
import { usePdfThumbnail } from "@/hooks/use-pdf-thumbnail"
import { cn } from "@/lib/utils"
import { formatFileSize, formatPageCount, type PdfItem } from "@/lib/pdf-files"

const DRAG_DISTANCE_PX = 8

const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args)
}

function setDocumentDragging(isDragging: boolean): void {
  document.documentElement.classList.toggle("is-dragging", isDragging)
}

function SortablePdfItem({
  item,
  disabled,
  processing,
  onPreview,
  onRemove,
}: {
  readonly item: PdfItem
  readonly disabled?: boolean
  readonly processing?: boolean
  readonly onPreview: (item: PdfItem) => void
  readonly onRemove: (id: string) => void
}) {
  const thumbnail = usePdfThumbnail(item.file)
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
  const pageLabel =
    thumbnail.pageCount != null ? formatPageCount(thumbnail.pageCount) : "PDF"

  return (
    <div
      ref={setNodeRef}
      role="listitem"
      className={cn(isDragging && "z-10")}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
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
          disabled={disabled}
          aria-label={`Preview ${item.file.name}`}
          onClick={() => onPreview(item)}
        />
        <AttachmentActions>
          <AttachmentAction
            {...attributes}
            {...listeners}
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
            disabled={disabled}
            aria-label={`Remove ${item.file.name}`}
            onClick={() => onRemove(item.id)}
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
          </AttachmentAction>
        </AttachmentActions>
      </Attachment>
    </div>
  )
}

export function SortablePdfList({
  items,
  disabled,
  processing,
  onPreview,
  onReorder,
  onRemove,
}: {
  readonly items: PdfItem[]
  readonly disabled?: boolean
  readonly processing?: boolean
  readonly onPreview: (item: PdfItem) => void
  readonly onReorder: (items: PdfItem[]) => void
  readonly onRemove: (id: string) => void
}) {
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

  function handleDragEnd(event: DragEndEvent): void {
    setDocumentDragging(false)

    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = items.findIndex((item) => item.id === active.id)
    const newIndex = items.findIndex((item) => item.id === over.id)

    if (oldIndex < 0 || newIndex < 0) {
      return
    }

    onReorder(arrayMove(items, oldIndex, newIndex))
  }

  return (
    <DndContext
      collisionDetection={collisionDetection}
      modifiers={[restrictToVerticalAxis]}
      sensors={sensors}
      onDragStart={() => setDocumentDragging(true)}
      onDragCancel={() => setDocumentDragging(false)}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          className="flex touch-pan-y flex-col gap-2"
          role="list"
          aria-label="PDF order"
        >
          {items.map((item) => (
            <SortablePdfItem
              key={item.id}
              item={item}
              disabled={disabled}
              processing={processing}
              onPreview={onPreview}
              onRemove={onRemove}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
