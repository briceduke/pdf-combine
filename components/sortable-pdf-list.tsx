"use client"

import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Cancel01Icon,
  DragDropVerticalIcon,
  Pdf01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { cn } from "@/lib/utils"
import { formatFileSize, type PdfItem } from "@/lib/pdf-files"

function SortablePdfItem({
  item,
  disabled,
  processing,
  onRemove,
}: {
  item: PdfItem
  disabled?: boolean
  processing?: boolean
  onRemove: (id: string) => void
}) {
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
    <Attachment
      ref={setNodeRef}
      state={processing ? "processing" : "done"}
      className={cn("w-full max-w-none", isDragging && "z-10 opacity-50")}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <AttachmentMedia>
        <HugeiconsIcon icon={Pdf01Icon} strokeWidth={2} />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{item.file.name}</AttachmentTitle>
        <AttachmentDescription>
          PDF · {formatFileSize(item.file.size)}
        </AttachmentDescription>
      </AttachmentContent>
      <AttachmentActions>
        <AttachmentAction
          variant="ghost"
          disabled={disabled}
          aria-label={`Drag to reorder ${item.file.name}`}
          {...attributes}
          {...listeners}
        >
          <HugeiconsIcon icon={DragDropVerticalIcon} strokeWidth={2} />
        </AttachmentAction>
        <AttachmentAction
          variant="ghost"
          disabled={disabled}
          aria-label={`Remove ${item.file.name}`}
          onClick={() => onRemove(item.id)}
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
        </AttachmentAction>
      </AttachmentActions>
    </Attachment>
  )
}

export function SortablePdfList({
  items,
  disabled,
  processing,
  onReorder,
  onRemove,
}: {
  items: PdfItem[]
  disabled?: boolean
  processing?: boolean
  onReorder: (items: PdfItem[]) => void
  onRemove: (id: string) => void
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
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
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      sensors={sensors}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2" role="list" aria-label="PDF order">
          {items.map((item) => (
            <div key={item.id} role="listitem">
              <SortablePdfItem
                item={item}
                disabled={disabled}
                processing={processing}
                onRemove={onRemove}
              />
            </div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
