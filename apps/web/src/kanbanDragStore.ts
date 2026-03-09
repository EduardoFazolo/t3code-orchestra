import { create } from "zustand";
import type { ProjectId, ThreadId } from "@t3tools/contracts";

export interface KanbanDragCard {
  title: string;
  description: string | undefined;
}

interface KanbanDragState {
  draggingCard: KanbanDragCard | null;
  hoveredThreadId: ThreadId | null;
  hoveredProjectId: ProjectId | null;
  setDraggingCard: (card: KanbanDragCard | null) => void;
  setHoveredThreadId: (id: ThreadId | null) => void;
  setHoveredProjectId: (id: ProjectId | null) => void;
}

export const useKanbanDragStore = create<KanbanDragState>()((set) => ({
  draggingCard: null,
  hoveredThreadId: null,
  hoveredProjectId: null,
  setDraggingCard: (card) => set({ draggingCard: card }),
  setHoveredThreadId: (id) => set({ hoveredThreadId: id }),
  setHoveredProjectId: (id) => set({ hoveredProjectId: id }),
}));
