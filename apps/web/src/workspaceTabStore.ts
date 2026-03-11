import { create } from "zustand";

export type WorkspaceTab = "chat" | "board";

interface WorkspaceTabState {
  activeTab: WorkspaceTab;
  setActiveTab: (tab: WorkspaceTab) => void;
}

export const useWorkspaceTabStore = create<WorkspaceTabState>()((set) => ({
  activeTab: "chat",
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
