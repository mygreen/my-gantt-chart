import { create } from "zustand";
import { fetchTasks } from "@/api/tasks";
import {
  resizeTaskByDays,
  resizeTaskStartByDays,
  shiftTaskByDays,
} from "@/core/scheduling/timeline";
import {
  type TaskDropPlacement,
  buildChildrenMap,
  getDescendantIds,
  normalizeParentTaskId,
  reorderTaskByDrop,
  reorderTaskByStep,
  syncParentTaskProgress,
} from "@/core/taskTree";
import { defaultViewport } from "@/core/viewport/constants";
import type {
  Dependency,
  Holiday,
  InteractionMode,
  Task,
  TimelineScale,
  Viewport,
} from "@/models/gantt";

type AddTaskMode = "child" | "tail";

type GanttState = {
  tasks: Task[];
  dependencies: Dependency[];
  holidays: Holiday[];
  viewport: Viewport;
  showOwnerInSidebar: boolean;
  excludeNonWorkingDays: boolean;
  timelineScale: TimelineScale;
  baselineDate: string;
  interactionMode: InteractionMode;
  pendingDependencyFromTaskId: number | null;
  selectedTaskId: number | null;
  collapsedTaskIds: number[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  loadTasks: () => Promise<void>;
  moveTaskByDays: (taskId: number, dayOffset: number) => void;
  resizeTaskByDays: (taskId: number, dayOffset: number) => void;
  resizeTaskStartByDays: (taskId: number, dayOffset: number) => void;
  moveTaskUp: (taskId: number) => void;
  moveTaskDown: (taskId: number) => void;
  moveTaskByDrop: (
    sourceTaskId: number,
    targetTaskId: number,
    placement: TaskDropPlacement,
  ) => void;
  toggleSidebarOwnerVisibility: () => void;
  toggleNonWorkingDayExclusion: () => void;
  setTimelineScale: (scale: TimelineScale) => void;
  setBaselineDate: (date: string) => void;
  setInteractionMode: (mode: InteractionMode) => void;
  selectTask: (taskId: number) => void;
  updateTaskDetails: (
    taskId: number,
    updates: Pick<Task, "name" | "owner" | "progress" | "status">,
  ) => void;
  setTaskParent: (taskId: number, parentTaskId: number | null) => void;
  toggleTaskCollapse: (taskId: number) => void;
  addTask: (mode: AddTaskMode) => void;
  deleteTask: (taskId: number) => void;
  toggleTaskDone: (taskId: number) => void;
  selectDependencyTask: (taskId: number) => void;
  removeDependency: (dependencyId: number) => void;
};

function withSubtreeTaskIds(taskId: number, tasks: Task[]) {
  return new Set([taskId, ...getDescendantIds(taskId, tasks)]);
}

function applyTaskUpdates(tasks: Task[], holidays: Holiday[], excludeNonWorkingDays: boolean) {
  return syncParentTaskProgress(tasks, holidays, excludeNonWorkingDays);
}

export const useGanttStore = create<GanttState>((set, get) => ({
  tasks: [],
  dependencies: [],
  holidays: [],
  viewport: defaultViewport,
  showOwnerInSidebar: true,
  excludeNonWorkingDays: false,
  timelineScale: "day",
  baselineDate: new Date().toISOString().slice(0, 10),
  interactionMode: "schedule",
  pendingDependencyFromTaskId: null,
  selectedTaskId: null,
  collapsedTaskIds: [],
  status: "idle",
  error: null,

  toggleSidebarOwnerVisibility: () => {
    set((state) => ({
      showOwnerInSidebar: !state.showOwnerInSidebar,
    }));
  },

  toggleNonWorkingDayExclusion: () => {
    set((state) => ({
      excludeNonWorkingDays: !state.excludeNonWorkingDays,
      tasks: applyTaskUpdates(state.tasks, state.holidays, !state.excludeNonWorkingDays),
    }));
  },

  setTimelineScale: (timelineScale) => {
    set({ timelineScale });
  },

  setBaselineDate: (baselineDate) => {
    set({ baselineDate });
  },

  setInteractionMode: (mode) => {
    set({
      interactionMode: mode,
      pendingDependencyFromTaskId: null,
    });
  },

  selectTask: (taskId) => {
    set({
      selectedTaskId: taskId,
    });
  },

  updateTaskDetails: (taskId, updates) => {
    set((state) => ({
      tasks: applyTaskUpdates(
        state.tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }

          const normalizedProgress = Math.max(0, Math.min(100, updates.progress));
          if (updates.status === "done" || normalizedProgress === 100) {
            return {
              ...task,
              name: updates.name,
              owner: updates.owner,
              progress: 100,
              status: "done" as const,
            };
          }

          return {
            ...task,
            name: updates.name,
            owner: updates.owner,
            progress: normalizedProgress,
            status: updates.status,
          };
        }),
        state.holidays,
        state.excludeNonWorkingDays,
      ),
    }));
  },

  setTaskParent: (taskId, parentTaskId) => {
    set((state) => ({
      tasks: applyTaskUpdates(
        state.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                parentTaskId: normalizeParentTaskId(taskId, parentTaskId, state.tasks),
              }
            : task,
        ),
        state.holidays,
        state.excludeNonWorkingDays,
      ),
    }));
  },

  toggleTaskCollapse: (taskId) => {
    set((state) => {
      const collapsed = new Set(state.collapsedTaskIds);
      if (collapsed.has(taskId)) {
        collapsed.delete(taskId);
      } else {
        const childrenMap = buildChildrenMap(state.tasks);
        if ((childrenMap.get(taskId) ?? []).length > 0) {
          collapsed.add(taskId);
        }
      }

      return {
        collapsedTaskIds: Array.from(collapsed),
      };
    });
  },

  addTask: (mode) => {
    set((state) => {
      const nextId = state.tasks.reduce((maxId, task) => Math.max(maxId, task.id), 0) + 1;
      const selectedTask = state.tasks.find((task) => task.id === state.selectedTaskId) ?? null;
      const tailTask = state.tasks[state.tasks.length - 1] ?? null;
      const parentTask = mode === "child" ? selectedTask : null;
      const baseDate =
        parentTask?.endDate ??
        tailTask?.endDate ??
        new Date().toISOString().slice(0, 10);

      const newTask: Task = {
        id: nextId,
        name: `新規タスク ${nextId}`,
        owner: "未設定",
        startDate: baseDate,
        endDate: baseDate,
        progress: 0,
        status: "todo",
        parentTaskId: parentTask?.id ?? null,
      };

      return {
        tasks: applyTaskUpdates(
          [...state.tasks, newTask],
          state.holidays,
          state.excludeNonWorkingDays,
        ),
        selectedTaskId: newTask.id,
      };
    });
  },

  deleteTask: (taskId) => {
    set((state) => {
      const subtreeIds = withSubtreeTaskIds(taskId, state.tasks);
      const nextTasks = state.tasks.filter((task) => !subtreeIds.has(task.id));
      const nextDependencies = state.dependencies.filter(
        (dependency) =>
          !subtreeIds.has(dependency.fromTaskId) && !subtreeIds.has(dependency.toTaskId),
      );

      return {
        tasks: applyTaskUpdates(nextTasks, state.holidays, state.excludeNonWorkingDays),
        dependencies: nextDependencies,
        selectedTaskId:
          state.selectedTaskId !== null && subtreeIds.has(state.selectedTaskId)
            ? (nextTasks[0]?.id ?? null)
            : state.selectedTaskId,
        pendingDependencyFromTaskId:
          state.pendingDependencyFromTaskId !== null &&
          subtreeIds.has(state.pendingDependencyFromTaskId)
            ? null
            : state.pendingDependencyFromTaskId,
        collapsedTaskIds: state.collapsedTaskIds.filter((id) => !subtreeIds.has(id)),
      };
    });
  },

  toggleTaskDone: (taskId) => {
    set((state) => ({
      tasks: applyTaskUpdates(
        state.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                progress: task.status === "done" ? 99 : 100,
                status: task.status === "done" ? "in_progress" : "done",
              }
            : task,
        ),
        state.holidays,
        state.excludeNonWorkingDays,
      ),
    }));
  },

  moveTaskUp: (taskId) => {
    set((state) => ({
      tasks: applyTaskUpdates(
        reorderTaskByStep(state.tasks, taskId, -1),
        state.holidays,
        state.excludeNonWorkingDays,
      ),
    }));
  },

  moveTaskDown: (taskId) => {
    set((state) => ({
      tasks: applyTaskUpdates(
        reorderTaskByStep(state.tasks, taskId, 1),
        state.holidays,
        state.excludeNonWorkingDays,
      ),
    }));
  },

  moveTaskByDrop: (sourceTaskId, targetTaskId, placement) => {
    set((state) => ({
      tasks: applyTaskUpdates(
        reorderTaskByDrop(state.tasks, sourceTaskId, targetTaskId, placement),
        state.holidays,
        state.excludeNonWorkingDays,
      ),
    }));
  },

  selectDependencyTask: (taskId) => {
    set((state) => {
      if (state.interactionMode !== "dependency") {
        return state;
      }

      if (state.pendingDependencyFromTaskId === null) {
        return {
          pendingDependencyFromTaskId: taskId,
        };
      }

      if (state.pendingDependencyFromTaskId === taskId) {
        return {
          pendingDependencyFromTaskId: null,
        };
      }

      const exists = state.dependencies.some(
        (dependency) =>
          dependency.fromTaskId === state.pendingDependencyFromTaskId &&
          dependency.toTaskId === taskId,
      );

      if (exists) {
        return {
          pendingDependencyFromTaskId: null,
        };
      }

      const nextId =
        state.dependencies.reduce((maxId, dependency) => Math.max(maxId, dependency.id), 0) + 1;

      return {
        dependencies: [
          ...state.dependencies,
          {
            id: nextId,
            fromTaskId: state.pendingDependencyFromTaskId,
            toTaskId: taskId,
          },
        ],
        pendingDependencyFromTaskId: null,
      };
    });
  },

  removeDependency: (dependencyId) => {
    set((state) => ({
      dependencies: state.dependencies.filter((dependency) => dependency.id !== dependencyId),
    }));
  },

  moveTaskByDays: (taskId, dayOffset) => {
    if (dayOffset === 0) {
      return;
    }

    set((state) => {
      const subtreeIds = withSubtreeTaskIds(taskId, state.tasks);
      return {
        tasks: applyTaskUpdates(
          state.tasks.map((task) =>
            subtreeIds.has(task.id) ? shiftTaskByDays(task, dayOffset) : task,
          ),
          state.holidays,
          state.excludeNonWorkingDays,
        ),
      };
    });
  },

  resizeTaskByDays: (taskId, dayOffset) => {
    if (dayOffset === 0) {
      return;
    }

    set((state) => ({
      tasks: applyTaskUpdates(
        state.tasks.map((task) => (task.id === taskId ? resizeTaskByDays(task, dayOffset) : task)),
        state.holidays,
        state.excludeNonWorkingDays,
      ),
    }));
  },

  resizeTaskStartByDays: (taskId, dayOffset) => {
    if (dayOffset === 0) {
      return;
    }

    set((state) => ({
      tasks: applyTaskUpdates(
        state.tasks.map((task) =>
          task.id === taskId ? resizeTaskStartByDays(task, dayOffset) : task,
        ),
        state.holidays,
        state.excludeNonWorkingDays,
      ),
    }));
  },

  loadTasks: async () => {
    set({ status: "loading", error: null });

    try {
      const data = await fetchTasks();
      const { excludeNonWorkingDays } = get();

      set({
        tasks: applyTaskUpdates(data.tasks, data.holidays, excludeNonWorkingDays),
        dependencies: data.dependencies,
        holidays: data.holidays,
        pendingDependencyFromTaskId: null,
        selectedTaskId: data.tasks[0]?.id ?? null,
        collapsedTaskIds: [],
        status: "ready",
      });
    } catch (error) {
      set({
        status: "error",
        error: error instanceof Error ? error.message : "タスクの読み込みに失敗しました。",
      });
    }
  },
}));
