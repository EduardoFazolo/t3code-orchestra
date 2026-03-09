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
import { GripVertical, PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { memo, useCallback, useRef, useState } from "react";
import type { ThreadId } from "@t3tools/contracts";
import { cn } from "~/lib/utils";
import {
  EMPTY_KANBAN_BOARD_SNAPSHOT,
  useKanbanStore,
  type KanbanCard,
  type KanbanColumn,
} from "../kanbanStore";
import { KanbanColorPicker, QUICK_PICKS } from "./KanbanColorPicker";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";

// ─── Default column colors (fallback for boards created before colors were added)

const DEFAULT_COLUMN_COLORS: Record<string, string> = {
  todo: "#64748b",
  "in-progress": "#3b82f6",
  review: "#f59e0b",
  done: "#22c55e",
};

function columnColor(column: KanbanColumn): string {
  return column.color ?? DEFAULT_COLUMN_COLORS[column.id] ?? "#64748b";
}

// ─── Edit card dialog ──────────────────────────────────────────────────────────

const EditCardDialog = memo(function EditCardDialog({
  card,
  columnId,
  threadId,
  open,
  onClose,
}: {
  card: KanbanCard;
  columnId: string;
  threadId: ThreadId;
  open: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [desc, setDesc] = useState(card.description ?? "");
  const updateCard = useKanbanStore((s) => s.updateCard);

  const save = useCallback(() => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const descTrimmed = desc.trim();
    updateCard(
      threadId,
      columnId,
      card.id,
      descTrimmed ? { title: trimmed, description: descTrimmed } : { title: trimmed },
    );
    onClose();
  }, [title, desc, updateCard, threadId, columnId, card.id, onClose]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogPopup showCloseButton={false} className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit card</DialogTitle>
        </DialogHeader>
        <DialogPanel>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Title</label>
              <input
                autoFocus
                className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") onClose();
                }}
                placeholder="Card title"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Description
              </label>
              <textarea
                className="w-full resize-none rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground outline-none focus:border-ring placeholder:text-muted-foreground/40"
                rows={3}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") onClose();
                }}
                placeholder="Optional description…"
              />
            </div>
          </div>
        </DialogPanel>
        <DialogFooter variant="bare">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={save}>
            Save
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
});

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
  const [editOpen, setEditOpen] = useState(false);
  const deleteCard = useKanbanStore((s) => s.deleteCard);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isSorting ? transition : undefined,
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        className={cn(
          "group flex rounded-lg border border-border bg-card shadow-sm transition-shadow hover:shadow-md hover:border-border/80",
          isDragging && "opacity-40",
        )}
      >
        {/* Drag zone — spans grip icon + title/description, full card height */}
        <div
          {...listeners}
          className="flex min-w-0 flex-1 cursor-grab items-start gap-2 py-2.5 pl-3 active:cursor-grabbing"
          aria-label="Drag card"
        >
          <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground/25 transition-colors group-hover:text-muted-foreground/55" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{card.title}</p>
            {card.description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{card.description}</p>
            )}
          </div>
        </div>

        {/* Action buttons — isolated from drag listeners */}
        <div className="flex shrink-0 items-center gap-0.5 self-start py-2 pr-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="rounded p-1 text-muted-foreground/60 hover:text-foreground"
            aria-label="Edit card"
          >
            <PencilIcon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => deleteCard(threadId, columnId, card.id)}
            className="rounded p-1 text-muted-foreground/60 hover:text-destructive"
            aria-label="Delete card"
          >
            <Trash2Icon className="size-3.5" />
          </button>
        </div>
      </div>

      <EditCardDialog
        card={card}
        columnId={columnId}
        threadId={threadId}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </>
  );
});

// ─── Card ghost ────────────────────────────────────────────────────────────────

const CardGhost = memo(function CardGhost({ card }: { card: KanbanCard }) {
  return (
    <div className="flex rotate-1 rounded-lg border border-ring/60 bg-card shadow-xl">
      <div className="flex items-center self-stretch px-2">
        <GripVertical className="size-3.5 text-muted-foreground/50" />
      </div>
      <div className="min-w-0 flex-1 py-2.5 pr-3">
        <p className="text-sm font-medium text-foreground">{card.title}</p>
        {card.description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{card.description}</p>
        )}
      </div>
    </div>
  );
});

// ─── Add card dialog ───────────────────────────────────────────────────────────

const AddCardDialog = memo(function AddCardDialog({
  columnId,
  threadId,
  open,
  onClose,
}: {
  columnId: string;
  threadId: ThreadId;
  open: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const addCard = useKanbanStore((s) => s.addCard);

  const submit = useCallback(() => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const descTrimmed = desc.trim();
    addCard(threadId, columnId, trimmed, descTrimmed || undefined);
    setTitle("");
    setDesc("");
    onClose();
  }, [title, desc, addCard, threadId, columnId, onClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogPopup showCloseButton={false} className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add card</DialogTitle>
        </DialogHeader>
        <DialogPanel>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Title</label>
              <input
                autoFocus
                className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                  if (e.key === "Escape") onClose();
                }}
                placeholder="Card title"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Description
              </label>
              <textarea
                className="w-full resize-none rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground outline-none focus:border-ring placeholder:text-muted-foreground/40"
                rows={3}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
                placeholder="Optional description…"
              />
            </div>
          </div>
        </DialogPanel>
        <DialogFooter variant="bare">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit}>Add card</Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
});

// ─── Edit column dialog ────────────────────────────────────────────────────────

const EditColumnDialog = memo(function EditColumnDialog({
  column,
  threadId,
  open,
  onClose,
}: {
  column: KanbanColumn;
  threadId: ThreadId;
  open: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(column.title);
  const [color, setColor] = useState<string | undefined>(columnColor(column));
  const updateColumn = useKanbanStore((s) => s.updateColumn);

  const save = useCallback(() => {
    const trimmed = title.trim();
    if (!trimmed) return;
    updateColumn(threadId, column.id, color ? { title: trimmed, color } : { title: trimmed });
    onClose();
  }, [title, color, updateColumn, threadId, column.id, onClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogPopup showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit column</DialogTitle>
        </DialogHeader>
        <DialogPanel>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
              <input
                autoFocus
                className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") onClose();
                }}
                placeholder="Column name"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">Color</label>
              <KanbanColorPicker value={color} onChange={setColor} />
            </div>
          </div>
        </DialogPanel>
        <DialogFooter variant="bare">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={save}>Save</Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
});

// ─── Add column dialog ─────────────────────────────────────────────────────────

const AddColumnDialog = memo(function AddColumnDialog({
  threadId,
  open,
  onClose,
}: {
  threadId: ThreadId;
  open: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [color, setColor] = useState<string | undefined>(QUICK_PICKS[3]);
  const addColumn = useKanbanStore((s) => s.addColumn);

  const submit = useCallback(() => {
    const trimmed = title.trim();
    if (!trimmed) return;
    addColumn(threadId, trimmed, color);
    setTitle("");
    setColor(QUICK_PICKS[3]);
    onClose();
  }, [title, color, addColumn, threadId, onClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogPopup showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add column</DialogTitle>
        </DialogHeader>
        <DialogPanel>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
              <input
                autoFocus
                className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                  if (e.key === "Escape") onClose();
                }}
                placeholder="Column name"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">Color</label>
              <KanbanColorPicker value={color} onChange={setColor} />
            </div>
          </div>
        </DialogPanel>
        <DialogFooter variant="bare">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit}>Add column</Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
});

// ─── Column ────────────────────────────────────────────────────────────────────

const Column = memo(function Column({
  column,
  threadId,
  activeCardId,
}: {
  column: KanbanColumn;
  threadId: ThreadId;
  activeCardId: string | null;
}) {
  const [addingCard, setAddingCard] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cardIds = column.cards.map((c) => c.id);
  const deleteColumn = useKanbanStore((s) => s.deleteColumn);

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", columnId: column.id },
  });

  const accentColor = columnColor(column);

  return (
    <>
    <div className="flex w-64 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-muted/30">
      {/* Color accent bar */}
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: accentColor }} />

      <div className="flex flex-1 flex-col p-3">
        {/* Column header */}
        <div className="group mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
            <h3 className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {column.title}
            </h3>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
              {column.cards.length}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => setEditDialogOpen(true)}
              className="rounded p-0.5 text-muted-foreground/60 hover:text-foreground"
              aria-label="Edit column"
            >
              <PencilIcon className="size-3" />
            </button>
            {confirmDelete ? (
              <>
                <button
                  type="button"
                  onClick={() => deleteColumn(threadId, column.id)}
                  className="rounded px-1.5 py-0.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded p-0.5 text-muted-foreground/60 hover:text-foreground"
                >
                  <XIcon className="size-3" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="rounded p-0.5 text-muted-foreground/60 hover:text-destructive"
                aria-label="Delete column"
              >
                <Trash2Icon className="size-3" />
              </button>
            )}
          </div>
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
          </div>
        </SortableContext>

        <button
          type="button"
          onClick={() => setAddingCard(true)}
          className="mt-3 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <PlusIcon className="size-3.5" />
          Add card
        </button>
      </div>
    </div>

    <AddCardDialog
      columnId={column.id}
      threadId={threadId}
      open={addingCard}
      onClose={() => setAddingCard(false)}
    />

    <EditColumnDialog
      column={column}
      threadId={threadId}
      open={editDialogOpen}
      onClose={() => setEditDialogOpen(false)}
    />
    </>
  );
});

// ─── Board ─────────────────────────────────────────────────────────────────────

export default function KanbanBoard({ threadId }: { threadId: ThreadId }) {
  const storedBoard = useKanbanStore((s) => s.boardsByThreadId[threadId]);
  const board = storedBoard ?? EMPTY_KANBAN_BOARD_SNAPSHOT;
  const moveCard = useKanbanStore((s) => s.moveCard);

  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
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

      if (fromColumnId === toColumnId) return;
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

      const { active, over } = event;
      if (!over || !prevCard) return;

      const activeData = active.data.current;
      const overData = over.data.current;
      if (activeData?.type !== "card" || overData?.type !== "card") return;

      const fromColumnId = activeData.columnId as string;
      const toColumnId = overData.columnId as string;
      if (fromColumnId !== toColumnId) return;

      const cardId = active.id as string;
      const currentBoard =
        useKanbanStore.getState().boardsByThreadId[threadId] ?? EMPTY_KANBAN_BOARD_SNAPSHOT;
      const col = currentBoard.columns.find((c) => c.id === fromColumnId);
      if (!col) return;

      const fromIndex = col.cards.findIndex((c) => c.id === cardId);
      const toIndex = col.cards.findIndex((c) => c.id === (over.id as string));
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

      moveCard(threadId, cardId, fromColumnId, toColumnId, toIndex);
    },
    [activeCard, moveCard, threadId],
  );

  return (
    <>
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

          <button
            type="button"
            onClick={() => setAddingColumn(true)}
            className="flex h-10 w-48 shrink-0 items-center gap-2 rounded-xl border border-dashed border-border px-4 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground"
          >
            <PlusIcon className="size-4" />
            Add column
          </button>
        </div>
      </div>

      <DragOverlay>{activeCard ? <CardGhost card={activeCard} /> : null}</DragOverlay>
    </DndContext>

    <AddColumnDialog
      threadId={threadId}
      open={addingColumn}
      onClose={() => setAddingColumn(false)}
    />
    </>
  );
}
