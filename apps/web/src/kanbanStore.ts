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
  color?: string;
  cards: KanbanCard[];
}

export interface KanbanBoardState {
  columns: KanbanColumn[];
}

export type KanbanBoardsByProjectId = Record<string, KanbanBoardState>;

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: "todo", title: "To-do", color: "#64748b", cards: [] },
  { id: "in-progress", title: "In Progress", color: "#3b82f6", cards: [] },
  { id: "review", title: "Review", color: "#f59e0b", cards: [] },
  { id: "done", title: "Done", color: "#22c55e", cards: [] },
];

function cloneDefaultColumn(column: KanbanColumn): KanbanColumn {
  return column.color
    ? {
        id: column.id,
        title: column.title,
        color: column.color,
        cards: [],
      }
    : {
        id: column.id,
        title: column.title,
        cards: [],
      };
}

export const EMPTY_KANBAN_BOARD_SNAPSHOT: KanbanBoardState = {
  columns: DEFAULT_COLUMNS.map(cloneDefaultColumn),
};
for (const column of EMPTY_KANBAN_BOARD_SNAPSHOT.columns) {
  Object.freeze(column.cards);
  Object.freeze(column);
}
Object.freeze(EMPTY_KANBAN_BOARD_SNAPSHOT.columns);
Object.freeze(EMPTY_KANBAN_BOARD_SNAPSHOT);

export function getDefaultBoard(): KanbanBoardState {
  return {
    columns: DEFAULT_COLUMNS.map(cloneDefaultColumn),
  };
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface KanbanStoreState {
  boardsByProjectId: KanbanBoardsByProjectId;
  getBoardForProject: (projectId: string) => KanbanBoardState;
  // Column management
  addColumn: (projectId: string, title: string, color?: string) => void;
  updateColumn: (
    projectId: string,
    columnId: string,
    updates: Partial<Pick<KanbanColumn, "title" | "color">>,
  ) => void;
  deleteColumn: (projectId: string, columnId: string) => void;
  // Card management
  addCard: (projectId: string, columnId: string, title: string, description?: string) => void;
  updateCard: (
    projectId: string,
    columnId: string,
    cardId: string,
    updates: Partial<Pick<KanbanCard, "title" | "description">>,
  ) => void;
  deleteCard: (projectId: string, columnId: string, cardId: string) => void;
  moveCard: (
    projectId: string,
    cardId: string,
    fromColumnId: string,
    toColumnId: string,
    toIndex: number,
  ) => void;
  reorderCard: (projectId: string, columnId: string, fromIndex: number, toIndex: number) => void;
}

function getOrCreateBoard(
  boardsByProjectId: KanbanBoardsByProjectId,
  projectId: string,
): KanbanBoardState {
  return boardsByProjectId[projectId] ?? getDefaultBoard();
}

function updateBoard(
  state: KanbanStoreState,
  projectId: string,
  updater: (board: KanbanBoardState) => KanbanBoardState,
): Partial<KanbanStoreState> {
  const current = getOrCreateBoard(state.boardsByProjectId, projectId);
  return {
    boardsByProjectId: {
      ...state.boardsByProjectId,
      [projectId]: updater(current),
    },
  };
}

export const useKanbanStore = create<KanbanStoreState>()(
  persist(
    (set, get) => ({
      boardsByProjectId: {},

      getBoardForProject(projectId) {
        return getOrCreateBoard(get().boardsByProjectId, projectId);
      },

      addColumn(projectId, title, color) {
        const col: KanbanColumn = color
          ? { id: newId("col"), title, color, cards: [] }
          : { id: newId("col"), title, cards: [] };
        set((state) =>
          updateBoard(state, projectId, (board) => ({
            ...board,
            columns: [...board.columns, col],
          })),
        );
      },

      updateColumn(projectId, columnId, updates) {
        set((state) =>
          updateBoard(state, projectId, (board) => ({
            ...board,
            columns: board.columns.map((col) =>
              col.id === columnId ? { ...col, ...updates } : col,
            ),
          })),
        );
      },

      deleteColumn(projectId, columnId) {
        set((state) =>
          updateBoard(state, projectId, (board) => ({
            ...board,
            columns: board.columns.filter((col) => col.id !== columnId),
          })),
        );
      },

      addCard(projectId, columnId, title, description) {
        const card: KanbanCard = description
          ? { id: newId("card"), title, description }
          : { id: newId("card"), title };
        set((state) =>
          updateBoard(state, projectId, (board) => ({
            ...board,
            columns: board.columns.map((col) =>
              col.id === columnId ? { ...col, cards: [...col.cards, card] } : col,
            ),
          })),
        );
      },

      updateCard(projectId, columnId, cardId, updates) {
        set((state) =>
          updateBoard(state, projectId, (board) => ({
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

      deleteCard(projectId, columnId, cardId) {
        set((state) =>
          updateBoard(state, projectId, (board) => ({
            ...board,
            columns: board.columns.map((col) =>
              col.id === columnId
                ? { ...col, cards: col.cards.filter((card) => card.id !== cardId) }
                : col,
            ),
          })),
        );
      },

      moveCard(projectId, cardId, fromColumnId, toColumnId, toIndex) {
        set((state) =>
          updateBoard(state, projectId, (board) => {
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

      reorderCard(projectId, columnId, fromIndex, toIndex) {
        set((state) =>
          updateBoard(state, projectId, (board) => ({
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
      name: "t3code:kanban:v2",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
