import { describe, expect, it } from "vitest";

import { EMPTY_KANBAN_BOARD_SNAPSHOT, getDefaultBoard } from "./kanbanStore";

describe("kanbanStore", () => {
  it("creates isolated writable boards", () => {
    const first = getDefaultBoard();
    const second = getDefaultBoard();

    expect(first).not.toBe(second);
    expect(first.columns).not.toBe(second.columns);
    expect(first.columns[0]).not.toBe(second.columns[0]);
    expect(first.columns[0]?.cards).not.toBe(second.columns[0]?.cards);
  });

  it("exposes a stable frozen empty board snapshot", () => {
    expect(Object.isFrozen(EMPTY_KANBAN_BOARD_SNAPSHOT)).toBe(true);
    expect(Object.isFrozen(EMPTY_KANBAN_BOARD_SNAPSHOT.columns)).toBe(true);
    expect(EMPTY_KANBAN_BOARD_SNAPSHOT.columns).toHaveLength(4);
    expect(EMPTY_KANBAN_BOARD_SNAPSHOT.columns.map((column) => column.id)).toEqual([
      "todo",
      "in-progress",
      "review",
      "done",
    ]);
    for (const column of EMPTY_KANBAN_BOARD_SNAPSHOT.columns) {
      expect(Object.isFrozen(column)).toBe(true);
      expect(Object.isFrozen(column.cards)).toBe(true);
      expect(column.cards).toEqual([]);
    }
  });
});
