import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

export interface KanbanBoardState {
  columns: KanbanColumn[];
}

export type KanbanBoardsByThreadId = Record<string, KanbanBoardState>;

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: "todo", title: "To-do", cards: [] },
  { id: "in-progress", title: "In Progress", cards: [] },
  { id: "review", title: "Review", cards: [] },
  { id: "done", title: "Done", cards: [] },
];

export function getDefaultBoard(): KanbanBoardState {
  return {
    columns: DEFAULT_COLUMNS.map((col) => ({ ...col, cards: [] })),
  };
}

interface KanbanStoreState {
  boardsByThreadId: KanbanBoardsByThreadId;
  getBoardForThread: (threadId: string) => KanbanBoardState;
  addCard: (threadId: string, columnId: string, title: string, description?: string) => void;
  updateCard: (
    threadId: string,
    columnId: string,
    cardId: string,
    updates: Partial<Pick<KanbanCard, "title" | "description">>,
  ) => void;
  deleteCard: (threadId: string, columnId: string, cardId: string) => void;
  moveCard: (
    threadId: string,
    cardId: string,
    fromColumnId: string,
    toColumnId: string,
    toIndex: number,
  ) => void;
  reorderCard: (threadId: string, columnId: string, fromIndex: number, toIndex: number) => void;
}

function newCardId() {
  return `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getOrCreateBoard(
  boardsByThreadId: KanbanBoardsByThreadId,
  threadId: string,
): KanbanBoardState {
  return boardsByThreadId[threadId] ?? getDefaultBoard();
}

function updateBoard(
  state: KanbanStoreState,
  threadId: string,
  updater: (board: KanbanBoardState) => KanbanBoardState,
): Partial<KanbanStoreState> {
  const current = getOrCreateBoard(state.boardsByThreadId, threadId);
  return {
    boardsByThreadId: {
      ...state.boardsByThreadId,
      [threadId]: updater(current),
    },
  };
}

export const useKanbanStore = create<KanbanStoreState>()(
  persist(
    (set, get) => ({
      boardsByThreadId: {},

      getBoardForThread(threadId) {
        return getOrCreateBoard(get().boardsByThreadId, threadId);
      },

      addCard(threadId, columnId, title, description) {
        const card: KanbanCard = description
          ? { id: newCardId(), title, description }
          : { id: newCardId(), title };
        set((state) =>
          updateBoard(state, threadId, (board) => ({
            ...board,
            columns: board.columns.map((col) =>
              col.id === columnId ? { ...col, cards: [...col.cards, card] } : col,
            ),
          })),
        );
      },

      updateCard(threadId, columnId, cardId, updates) {
        set((state) =>
          updateBoard(state, threadId, (board) => ({
            ...board,
            columns: board.columns.map((col) =>
              col.id === columnId
                ? {
                    ...col,
                    cards: col.cards.map((card) =>
                      card.id === cardId ? { ...card, ...updates } : card,
                    ),
                  }
                : col,
            ),
          })),
        );
      },

      deleteCard(threadId, columnId, cardId) {
        set((state) =>
          updateBoard(state, threadId, (board) => ({
            ...board,
            columns: board.columns.map((col) =>
              col.id === columnId
                ? { ...col, cards: col.cards.filter((card) => card.id !== cardId) }
                : col,
            ),
          })),
        );
      },

      moveCard(threadId, cardId, fromColumnId, toColumnId, toIndex) {
        set((state) =>
          updateBoard(state, threadId, (board) => {
            const fromCol = board.columns.find((c) => c.id === fromColumnId);
            if (!fromCol) return board;
            const card = fromCol.cards.find((c) => c.id === cardId);
            if (!card) return board;

            return {
              ...board,
              columns: board.columns.map((col) => {
                if (col.id === fromColumnId && col.id === toColumnId) {
                  const cards = col.cards.filter((c) => c.id !== cardId);
                  cards.splice(toIndex, 0, card);
                  return { ...col, cards };
                }
                if (col.id === fromColumnId) {
                  return { ...col, cards: col.cards.filter((c) => c.id !== cardId) };
                }
                if (col.id === toColumnId) {
                  const cards = [...col.cards];
                  cards.splice(toIndex, 0, card);
                  return { ...col, cards };
                }
                return col;
              }),
            };
          }),
        );
      },

      reorderCard(threadId, columnId, fromIndex, toIndex) {
        set((state) =>
          updateBoard(state, threadId, (board) => ({
            ...board,
            columns: board.columns.map((col) => {
              if (col.id !== columnId) return col;
              const cards = [...col.cards];
              const [moved] = cards.splice(fromIndex, 1);
              if (moved) cards.splice(toIndex, 0, moved);
              return { ...col, cards };
            }),
          })),
        );
      },
    }),
    {
      name: "t3code:kanban:v1",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
