import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, PencilIcon, PlusIcon, Trash2Icon, XIcon, CheckIcon } from "lucide-react";
import { memo, useCallback, useRef, useState } from "react";
import type { ThreadId } from "@t3tools/contracts";
import { cn } from "~/lib/utils";
import { getDefaultBoard, useKanbanStore, type KanbanCard, type KanbanColumn } from "../kanbanStore";

// ─── Card ─────────────────────────────────────────────────────────────────────

interface CardItemProps {
  card: KanbanCard;
  columnId: string;
  threadId: ThreadId;
  isDragging?: boolean;
}

const CardItem = memo(function CardItem({ card, columnId, threadId, isDragging }: CardItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isSorting } = useSortable({
    id: card.id,
    data: { type: "card", card, columnId },
  });

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(card.title);
  const [editDesc, setEditDesc] = useState(card.description ?? "");
  const updateCard = useKanbanStore((s) => s.updateCard);
  const deleteCard = useKanbanStore((s) => s.deleteCard);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isSorting ? transition : undefined,
  };

  const saveEdit = useCallback(() => {
    const trimmed = editTitle.trim();
    if (!trimmed) return;
    const descTrimmed = editDesc.trim();
    updateCard(
      threadId,
      columnId,
      card.id,
      descTrimmed ? { title: trimmed, description: descTrimmed } : { title: trimmed },
    );
    setEditing(false);
  }, [editTitle, editDesc, updateCard, threadId, columnId, card.id]);

  const cancelEdit = useCallback(() => {
    setEditTitle(card.title);
    setEditDesc(card.description ?? "");
    setEditing(false);
  }, [card.title, card.description]);

  if (editing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="rounded-lg border border-ring/40 bg-card p-2.5 shadow-sm"
      >
        <input
          autoFocus
          className="w-full rounded bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/50"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveEdit();
            if (e.key === "Escape") cancelEdit();
          }}
          placeholder="Card title"
        />
        <textarea
          className="mt-1.5 w-full resize-none rounded bg-transparent text-xs text-muted-foreground outline-none placeholder:text-muted-foreground/40"
          rows={2}
          value={editDesc}
          onChange={(e) => setEditDesc(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancelEdit();
          }}
          placeholder="Description (optional)"
        />
        <div className="mt-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={saveEdit}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <CheckIcon className="size-3" />
            Save
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <XIcon className="size-3" />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group relative rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm transition-shadow",
        "cursor-grab active:cursor-grabbing hover:shadow-md hover:border-border/80",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/30 transition-opacity group-hover:text-muted-foreground/60" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{card.title}</p>
          {card.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{card.description}</p>
          )}
        </div>
        <div
          className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
          // Prevent drag from triggering when clicking action buttons
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded p-0.5 text-muted-foreground/60 hover:text-foreground"
            aria-label="Edit card"
          >
            <PencilIcon className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => deleteCard(threadId, columnId, card.id)}
            className="rounded p-0.5 text-muted-foreground/60 hover:text-destructive"
            aria-label="Delete card"
          >
            <Trash2Icon className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── Card ghost for DragOverlay ────────────────────────────────────────────────

const CardGhost = memo(function CardGhost({ card }: { card: KanbanCard }) {
  return (
    <div className="rotate-1 rounded-lg border border-ring/60 bg-card px-3 py-2.5 shadow-xl">
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{card.title}</p>
          {card.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{card.description}</p>
          )}
        </div>
      </div>
    </div>
  );
});

// ─── Add card form ─────────────────────────────────────────────────────────────

interface AddCardFormProps {
  columnId: string;
  threadId: ThreadId;
  onDone: () => void;
}

const AddCardForm = memo(function AddCardForm({ columnId, threadId, onDone }: AddCardFormProps) {
  const [title, setTitle] = useState("");
  const addCard = useKanbanStore((s) => s.addCard);

  const submit = useCallback(() => {
    const trimmed = title.trim();
    if (!trimmed) {
      onDone();
      return;
    }
    addCard(threadId, columnId, trimmed);
    setTitle("");
    onDone();
  }, [title, addCard, threadId, columnId, onDone]);

  return (
    <div className="rounded-lg border border-ring/40 bg-card p-2.5">
      <input
        autoFocus
        className="w-full rounded bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/50"
        placeholder="Card title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onDone();
        }}
      />
      <div className="mt-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={submit}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <CheckIcon className="size-3" />
          Add
        </button>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-3" />
          Cancel
        </button>
      </div>
    </div>
  );
});

// ─── Column ────────────────────────────────────────────────────────────────────

interface ColumnProps {
  column: KanbanColumn;
  threadId: ThreadId;
  activeCardId: string | null;
}

const Column = memo(function Column({ column, threadId, activeCardId }: ColumnProps) {
  const [addingCard, setAddingCard] = useState(false);
  const cardIds = column.cards.map((c) => c.id);

  // Make the column body a droppable target (for empty columns and hovering over the column area)
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", columnId: column.id },
  });

  return (
    <div className="flex w-64 shrink-0 flex-col rounded-xl border border-border bg-muted/30 p-3">
      {/* Column header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {column.title}
        </h3>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          {column.cards.length}
        </span>
      </div>

      {/* Cards */}
      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "flex flex-1 flex-col gap-2 overflow-y-auto rounded-lg transition-colors",
            isOver && "bg-muted/40",
            column.cards.length === 0 && "min-h-16",
          )}
        >
          {column.cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              columnId={column.id}
              threadId={threadId}
              isDragging={activeCardId === card.id}
            />
          ))}
          {addingCard && (
            <AddCardForm
              columnId={column.id}
              threadId={threadId}
              onDone={() => setAddingCard(false)}
            />
          )}
        </div>
      </SortableContext>

      {/* Add card button */}
      {!addingCard && (
        <button
          type="button"
          onClick={() => setAddingCard(true)}
          className="mt-3 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <PlusIcon className="size-3.5" />
          Add card
        </button>
      )}
    </div>
  );
});

// ─── Board ─────────────────────────────────────────────────────────────────────

interface KanbanBoardProps {
  threadId: ThreadId;
}

export default function KanbanBoard({ threadId }: KanbanBoardProps) {
  const board = useKanbanStore((s) => s.boardsByThreadId[threadId] ?? getDefaultBoard());
  const moveCard = useKanbanStore((s) => s.moveCard);

  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null);
  // Track the card's current column during drag via ref (active.data.current is stale after cross-column moves)
  const activeCardColumnRef = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const onDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === "card") {
      setActiveCard(data.card as KanbanCard);
      activeCardColumnRef.current = data.columnId as string;
    }
  }, []);

  const onDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over || !activeCardColumnRef.current) return;

      const activeData = active.data.current;
      if (activeData?.type !== "card") return;

      const cardId = active.id as string;
      const fromColumnId = activeCardColumnRef.current;
      const overData = over.data.current;

      let toColumnId: string;
      let toIndex: number;

      if (overData?.type === "card") {
        toColumnId = overData.columnId as string;
        const toColumn = useKanbanStore
          .getState()
          .boardsByThreadId[threadId]?.columns.find((c) => c.id === toColumnId);
        if (!toColumn) return;
        toIndex = toColumn.cards.findIndex((c) => c.id === (over.id as string));
        if (toIndex === -1) toIndex = toColumn.cards.length;
      } else if (overData?.type === "column") {
        toColumnId = overData.columnId as string;
        const toColumn = useKanbanStore
          .getState()
          .boardsByThreadId[threadId]?.columns.find((c) => c.id === toColumnId);
        toIndex = toColumn?.cards.length ?? 0;
      } else {
        return;
      }

      if (fromColumnId === toColumnId) return; // Same column: SortableContext handles reorder

      moveCard(threadId, cardId, fromColumnId, toColumnId, toIndex);
      activeCardColumnRef.current = toColumnId;
    },
    [moveCard, threadId],
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const prevCard = activeCard;
      setActiveCard(null);
      activeCardColumnRef.current = null;

      // Handle same-column reorder (cross-column is already committed in onDragOver)
      const { active, over } = event;
      if (!over || !prevCard) return;

      const activeData = active.data.current;
      const overData = over.data.current;
      if (activeData?.type !== "card" || overData?.type !== "card") return;

      const fromColumnId = activeData.columnId as string;
      const toColumnId = overData.columnId as string;
      if (fromColumnId !== toColumnId) return; // Already handled in onDragOver

      const cardId = active.id as string;
      const currentBoard =
        useKanbanStore.getState().boardsByThreadId[threadId] ?? getDefaultBoard();
      const column = currentBoard.columns.find((c) => c.id === fromColumnId);
      if (!column) return;

      const fromIndex = column.cards.findIndex((c) => c.id === cardId);
      const toIndex = column.cards.findIndex((c) => c.id === (over.id as string));
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

      moveCard(threadId, cardId, fromColumnId, toColumnId, toIndex);
    },
    [activeCard, moveCard, threadId],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 items-start gap-4 overflow-x-auto p-6">
          {board.columns.map((column) => (
            <Column
              key={column.id}
              column={column}
              threadId={threadId}
              activeCardId={activeCard?.id ?? null}
            />
          ))}
        </div>
      </div>

      <DragOverlay>{activeCard ? <CardGhost card={activeCard} /> : null}</DragOverlay>
    </DndContext>
  );
}
