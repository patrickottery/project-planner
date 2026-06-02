import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "../api";

export const useStore = create(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      tasks: [],
      activeTaskId: null,
      activeView: "tree",
      collapsed: {},
      undoStack: [],
      sidebarOpen: true,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (v) => set({ sidebarOpen: v }),

      setActiveProject: (id) => set({ activeProjectId: id, activeTaskId: null }),
      setActiveTask: (id) => set({ activeTaskId: id }),
      setActiveView: (view) => set({ activeView: view }),

      toggleCollapsed: (taskId) =>
        set((s) => ({
          collapsed: { ...s.collapsed, [taskId]: !s.collapsed[taskId] },
        })),

      pushUndo: (action) =>
        set((s) => ({ undoStack: [...s.undoStack.slice(-29), action] })),

      popUndo: () => {
        const stack = get().undoStack;
        if (!stack.length) return null;
        const last = stack[stack.length - 1];
        set({ undoStack: stack.slice(0, -1) });
        return last;
      },

      fetchProjects: async () => {
        const projects = await api.getProjects();
        set({ projects });
      },

      fetchTasks: async (pid) => {
        const tasks = await api.getProjectTasks(pid);
        set({ tasks });
      },

      refreshProject: async () => {
        const { activeProjectId } = get();
        if (activeProjectId) {
          await get().fetchTasks(activeProjectId);
          const projects = await api.getProjects();
          set({ projects });
        }
      },
    }),
    {
      name: "project-planner",
      partialize: (s) => ({
        activeProjectId: s.activeProjectId,
        activeView: s.activeView,
        collapsed: s.collapsed,
      }),
    }
  )
);
