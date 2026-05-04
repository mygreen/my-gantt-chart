import { create } from "zustand";
import { fetchTasks, saveTasks, type GanttResponse, type SaveGanttPayload } from "@/api/tasks";
import {
  resizeTaskByDays,
  resizeTaskStartByDays,
  shiftTaskByDays,
} from "@/core/scheduling/timeline";
import {
  type TaskDropPlacement,
  buildChildrenMap,
  buildOrderedTasks,
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
  Member,
  Task,
  TaskType,
  TimelineScale,
  Viewport,
} from "@/models/gantt";

type AddTaskMode = "child" | "sibling" | "tail";
type StoreStatus = "idle" | "loading" | "ready" | "error";

type PersistedState = Omit<SaveGanttPayload, "version"> & {
  projectVersion: number;
};

type GanttState = {
  projectName: string;
  projectVersion: number;
  projectStartDate: string;
  projectEndDate: string;
  members: Member[];
  tasks: Task[];
  dependencies: Dependency[];
  holidays: Holiday[];
  viewport: Viewport;
  showOwnerInSidebar: boolean;
  showStartDateInSidebar: boolean;
  showEndDateInSidebar: boolean;
  showAllParentTaskOptions: boolean;
  excludeNonWorkingDays: boolean;
  timelineScale: TimelineScale;
  baselineDate: string;
  interactionMode: InteractionMode;
  pendingDependencyFromTaskId: number | null;
  selectedTaskId: number | null;
  collapsedTaskIds: number[];
  status: StoreStatus;
  error: string | null;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  savedState: PersistedState | null;
  savedSnapshot: string | null;
  setProjectName: (name: string) => void;
  setProjectSchedule: (startDate: string, endDate: string) => void;
  loadTasks: () => Promise<void>;
  saveChanges: () => Promise<void>;
  discardChanges: () => void;
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
  toggleSidebarStartDateVisibility: () => void;
  toggleSidebarEndDateVisibility: () => void;
  toggleAllParentTaskOptionsVisibility: () => void;
  toggleNonWorkingDayExclusion: () => void;
  setTimelineScale: (scale: TimelineScale) => void;
  setBaselineDate: (date: string) => void;
  setInteractionMode: (mode: InteractionMode) => void;
  selectTask: (taskId: number) => void;
  updateTaskDetails: (
    taskId: number,
    updates: Pick<Task, "name" | "owner" | "progress" | "status">,
  ) => void;
  updateTaskSchedule: (taskId: number, startDate: string, endDate: string) => void;
  setTaskParent: (taskId: number, parentTaskId: number | null) => void;
  toggleTaskCollapse: (taskId: number) => void;
  addTask: (mode: AddTaskMode, type?: TaskType) => void;
  deleteTask: (taskId: number) => void;
  toggleTaskDone: (taskId: number) => void;
  selectDependencyTask: (taskId: number) => void;
  removeDependency: (dependencyId: number) => void;
  addHoliday: () => void;
  updateHoliday: (holidayId: number, updates: Pick<Holiday, "date" | "name">) => void;
  deleteHoliday: (holidayId: number) => void;
  importHolidays: (holidays: Array<Pick<Holiday, "date" | "name">>) => void;
  addMember: () => void;
  updateMember: (memberId: number, name: string) => void;
  deleteMember: (memberId: number) => void;
  moveMemberUp: (memberId: number) => void;
  moveMemberDown: (memberId: number) => void;
};

type DirtyComputableState = Pick<
  GanttState,
  | "projectName"
  | "projectVersion"
  | "projectStartDate"
  | "projectEndDate"
  | "members"
  | "tasks"
  | "dependencies"
  | "holidays"
  | "excludeNonWorkingDays"
>;

function withSubtreeTaskIds(taskId: number, tasks: Task[]) {
  return new Set([taskId, ...getDescendantIds(taskId, tasks)]);
}

function clampProgress(progress: number) {
  return Math.max(0, Math.min(100, progress));
}

function applyTaskUpdates(tasks: Task[], holidays: Holiday[], excludeNonWorkingDays: boolean) {
  return syncParentTaskProgress(tasks, holidays, excludeNonWorkingDays);
}

function deriveMembers(tasks: Task[]) {
  const names = Array.from(
    new Set(tasks.map((task) => task.owner.trim()).filter((owner) => owner.length > 0)),
  );

  return names.map((name, index) => ({
    id: index + 1,
    name,
  }));
}

function reorderMembersByStep(members: Member[], memberId: number, direction: -1 | 1) {
  const index = members.findIndex((member) => member.id === memberId);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= members.length) {
    return members;
  }

  const next = [...members];
  const [member] = next.splice(index, 1);
  next.splice(targetIndex, 0, member);
  return next;
}

function normalizeTaskDates(startDate: string, endDate: string, type: TaskType) {
  if (type === "milestone") {
    return {
      startDate,
      endDate: startDate,
    };
  }

  if (endDate < startDate) {
    return {
      startDate,
      endDate: startDate,
    };
  }

  return {
    startDate,
    endDate,
  };
}

function insertTaskByMode(
  tasks: Task[],
  newTask: Task,
  mode: AddTaskMode,
  selectedTaskId: number | null,
) {
  if (mode === "tail" || selectedTaskId === null) {
    return [...tasks, newTask];
  }

  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  if (!selectedTask) {
    return [...tasks, newTask];
  }

  if (mode === "child") {
    const childIds = new Set(getDescendantIds(selectedTask.id, tasks));
    let insertIndex = tasks.findIndex((task) => task.id === selectedTask.id) + 1;

    while (insertIndex < tasks.length && childIds.has(tasks[insertIndex].id)) {
      insertIndex += 1;
    }

    return [...tasks.slice(0, insertIndex), newTask, ...tasks.slice(insertIndex)];
  }

  const subtreeIds = withSubtreeTaskIds(selectedTask.id, tasks);
  let insertIndex = tasks.findIndex((task) => task.id === selectedTask.id) + 1;
  while (insertIndex < tasks.length && subtreeIds.has(tasks[insertIndex].id)) {
    insertIndex += 1;
  }

  return [...tasks.slice(0, insertIndex), newTask, ...tasks.slice(insertIndex)];
}

function buildPersistedState(source: DirtyComputableState): SaveGanttPayload {
  return {
    projectName: source.projectName,
    version: source.projectVersion,
    projectStartDate: source.projectStartDate,
    projectEndDate: source.projectEndDate,
    excludeNonWorkingDays: source.excludeNonWorkingDays,
    members: source.members.map((member) => ({
      id: member.id,
      name: member.name,
    })),
    tasks: buildOrderedTasks(source.tasks).map((task) => ({
      ...task,
      parentTaskId: task.parentTaskId ?? null,
      type: task.type ?? "task",
    })),
    dependencies: source.dependencies.map((dependency) => ({ ...dependency })),
    holidays: source.holidays.map((holiday) => ({ ...holiday })),
  };
}

function serializePersistedState(source: SaveGanttPayload) {
  return JSON.stringify(source);
}

function computeDirtyFlag(
  source: DirtyComputableState,
  savedSnapshot: string | null,
) {
  if (!savedSnapshot) {
    return false;
  }

  return serializePersistedState(buildPersistedState(source)) !== savedSnapshot;
}

function applyDirtyAwareUpdate(
  state: GanttState,
  updates: Partial<GanttState>,
): Partial<GanttState> {
  const merged = { ...state, ...updates };
  return {
    ...updates,
    hasUnsavedChanges: computeDirtyFlag(merged, state.savedSnapshot),
  };
}

function normalizeLoadedState(data: GanttResponse): PersistedState {
  const members = data.members.length > 0 ? data.members : deriveMembers(data.tasks);
  return {
    projectName: data.projectName,
    projectVersion: data.version,
    projectStartDate: data.projectStartDate,
    projectEndDate: data.projectEndDate,
    excludeNonWorkingDays: data.excludeNonWorkingDays,
    members,
    tasks: data.tasks.map((task) => ({
      ...task,
      parentTaskId: task.parentTaskId ?? null,
      type: task.type ?? "task",
    })),
    dependencies: data.dependencies.map((dependency) => ({ ...dependency })),
    holidays: data.holidays.map((holiday) => ({ ...holiday })),
  };
}

function findTaskSelection(
  requestedTaskId: number | null,
  previousTasks: Task[],
  nextTasks: Task[],
) {
  if (requestedTaskId === null) {
    return nextTasks[0]?.id ?? null;
  }

  if (nextTasks.some((task) => task.id === requestedTaskId)) {
    return requestedTaskId;
  }

  const previousTask = previousTasks.find((task) => task.id === requestedTaskId);
  if (!previousTask) {
    return nextTasks[0]?.id ?? null;
  }

  const matchedTask = nextTasks.find(
    (task) =>
      task.name === previousTask.name &&
      task.type === previousTask.type &&
      task.startDate === previousTask.startDate &&
      task.endDate === previousTask.endDate,
  );

  return matchedTask?.id ?? nextTasks[0]?.id ?? null;
}

function restoreSavedState(
  savedState: PersistedState,
  selectedTaskId: number | null,
  currentTasks: Task[],
): Partial<GanttState> {
  const nextTasks = applyTaskUpdates(
    savedState.tasks,
    savedState.holidays,
    savedState.excludeNonWorkingDays,
  );

  return {
    projectName: savedState.projectName,
    projectVersion: savedState.projectVersion,
    projectStartDate: savedState.projectStartDate,
    projectEndDate: savedState.projectEndDate,
    members: savedState.members,
    tasks: nextTasks,
    dependencies: savedState.dependencies,
    holidays: savedState.holidays,
    excludeNonWorkingDays: savedState.excludeNonWorkingDays,
    selectedTaskId: findTaskSelection(selectedTaskId, currentTasks, nextTasks),
    pendingDependencyFromTaskId: null,
    collapsedTaskIds: [],
    hasUnsavedChanges: false,
  };
}

const initialToday = new Date().toISOString().slice(0, 10);

export const useGanttStore = create<GanttState>((set, get) => ({
  projectName: "チーム進行ガントチャート",
  projectVersion: 1,
  projectStartDate: initialToday,
  projectEndDate: initialToday,
  members: [],
  tasks: [],
  dependencies: [],
  holidays: [],
  viewport: defaultViewport,
  showOwnerInSidebar: true,
  showStartDateInSidebar: false,
  showEndDateInSidebar: false,
  showAllParentTaskOptions: false,
  excludeNonWorkingDays: false,
  timelineScale: "day",
  baselineDate: initialToday,
  interactionMode: "schedule",
  pendingDependencyFromTaskId: null,
  selectedTaskId: null,
  collapsedTaskIds: [],
  status: "idle",
  error: null,
  hasUnsavedChanges: false,
  isSaving: false,
  savedState: null,
  savedSnapshot: null,

  setProjectName: (projectName) => {
    set((state) => applyDirtyAwareUpdate(state, { projectName }));
  },

  setProjectSchedule: (projectStartDate, projectEndDate) => {
    set((state) =>
      applyDirtyAwareUpdate(state, {
        projectStartDate,
        projectEndDate: projectEndDate < projectStartDate ? projectStartDate : projectEndDate,
      }),
    );
  },

  toggleSidebarOwnerVisibility: () => {
    set((state) => ({
      showOwnerInSidebar: !state.showOwnerInSidebar,
    }));
  },

  toggleSidebarStartDateVisibility: () => {
    set((state) => ({
      showStartDateInSidebar: !state.showStartDateInSidebar,
    }));
  },

  toggleSidebarEndDateVisibility: () => {
    set((state) => ({
      showEndDateInSidebar: !state.showEndDateInSidebar,
    }));
  },

  toggleAllParentTaskOptionsVisibility: () => {
    set((state) => ({
      showAllParentTaskOptions: !state.showAllParentTaskOptions,
    }));
  },

  toggleNonWorkingDayExclusion: () => {
    set((state) =>
      applyDirtyAwareUpdate(state, {
        excludeNonWorkingDays: !state.excludeNonWorkingDays,
        tasks: applyTaskUpdates(state.tasks, state.holidays, !state.excludeNonWorkingDays),
      }),
    );
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
    set((state) => {
      const nextTasks = applyTaskUpdates(
        state.tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }

          const normalizedProgress = clampProgress(updates.progress);
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
      );

      return applyDirtyAwareUpdate(state, { tasks: nextTasks });
    });
  },

  updateTaskSchedule: (taskId, startDate, endDate) => {
    set((state) => {
      const nextTasks = applyTaskUpdates(
        state.tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }

          const normalizedDates = normalizeTaskDates(startDate, endDate, task.type);
          return {
            ...task,
            ...normalizedDates,
          };
        }),
        state.holidays,
        state.excludeNonWorkingDays,
      );

      return applyDirtyAwareUpdate(state, { tasks: nextTasks });
    });
  },

  setTaskParent: (taskId, parentTaskId) => {
    set((state) => {
      const nextTasks = applyTaskUpdates(
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
      );

      return applyDirtyAwareUpdate(state, { tasks: nextTasks });
    });
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

  addTask: (mode, type = "task") => {
    set((state) => {
      const nextId = state.tasks.reduce((maxId, task) => Math.max(maxId, task.id), 0) + 1;
      const selectedTask = state.tasks.find((task) => task.id === state.selectedTaskId) ?? null;
      const tailTask = state.tasks[state.tasks.length - 1] ?? null;
      const parentTaskId =
        mode === "child"
          ? (selectedTask?.id ?? null)
          : mode === "sibling"
            ? (selectedTask?.parentTaskId ?? null)
            : null;
      const baseDate =
        selectedTask?.endDate ?? tailTask?.endDate ?? new Date().toISOString().slice(0, 10);

      const newTask: Task = {
        id: nextId,
        name: type === "milestone" ? `マイルストーン ${nextId}` : `新規タスク ${nextId}`,
        owner: "未設定",
        startDate: baseDate,
        endDate: baseDate,
        progress: 0,
        status: "todo",
        parentTaskId,
        type,
      };

      const nextTasks = insertTaskByMode(state.tasks, newTask, mode, state.selectedTaskId);
      return applyDirtyAwareUpdate(state, {
        tasks: applyTaskUpdates(nextTasks, state.holidays, state.excludeNonWorkingDays),
        selectedTaskId: newTask.id,
      });
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

      return applyDirtyAwareUpdate(state, {
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
      });
    });
  },

  toggleTaskDone: (taskId) => {
    set((state) => {
      const nextTasks = applyTaskUpdates(
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
      );
      return applyDirtyAwareUpdate(state, { tasks: nextTasks });
    });
  },

  moveTaskUp: (taskId) => {
    set((state) =>
      applyDirtyAwareUpdate(state, {
        tasks: applyTaskUpdates(
          reorderTaskByStep(state.tasks, taskId, -1),
          state.holidays,
          state.excludeNonWorkingDays,
        ),
      }),
    );
  },

  moveTaskDown: (taskId) => {
    set((state) =>
      applyDirtyAwareUpdate(state, {
        tasks: applyTaskUpdates(
          reorderTaskByStep(state.tasks, taskId, 1),
          state.holidays,
          state.excludeNonWorkingDays,
        ),
      }),
    );
  },

  moveTaskByDrop: (sourceTaskId, targetTaskId, placement) => {
    set((state) =>
      applyDirtyAwareUpdate(state, {
        tasks: applyTaskUpdates(
          reorderTaskByDrop(state.tasks, sourceTaskId, targetTaskId, placement),
          state.holidays,
          state.excludeNonWorkingDays,
        ),
      }),
    );
  },

  selectDependencyTask: (taskId) => {
    set((state) => {
      if (state.interactionMode !== "dependency") {
        return state;
      }

      const task = state.tasks.find((candidate) => candidate.id === taskId);
      if (!task || task.type === "milestone") {
        return {
          pendingDependencyFromTaskId: null,
        };
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

      return applyDirtyAwareUpdate(state, {
        dependencies: [
          ...state.dependencies,
          {
            id: nextId,
            fromTaskId: state.pendingDependencyFromTaskId,
            toTaskId: taskId,
          },
        ],
        pendingDependencyFromTaskId: null,
      });
    });
  },

  removeDependency: (dependencyId) => {
    set((state) =>
      applyDirtyAwareUpdate(state, {
        dependencies: state.dependencies.filter((dependency) => dependency.id !== dependencyId),
      }),
    );
  },

  addHoliday: () => {
    set((state) => {
      const nextId = state.holidays.reduce((maxId, holiday) => Math.max(maxId, holiday.id), 0) + 1;
      return applyDirtyAwareUpdate(state, {
        holidays: [
          ...state.holidays,
          {
            id: nextId,
            date: state.projectStartDate,
            name: "新しい祝日",
          },
        ],
      });
    });
  },

  updateHoliday: (holidayId, updates) => {
    set((state) =>
      applyDirtyAwareUpdate(state, {
        holidays: state.holidays.map((holiday) =>
          holiday.id === holidayId ? { ...holiday, ...updates } : holiday,
        ),
      }),
    );
  },

  deleteHoliday: (holidayId) => {
    set((state) =>
      applyDirtyAwareUpdate(state, {
        holidays: state.holidays.filter((holiday) => holiday.id !== holidayId),
      }),
    );
  },

  importHolidays: (holidays) => {
    set((state) => {
      let nextId = state.holidays.reduce((maxId, holiday) => Math.max(maxId, holiday.id), 0) + 1;
      const existingByDate = new Map(state.holidays.map((holiday) => [holiday.date, holiday]));
      const importedByDate = new Map(
        holidays
          .filter((holiday) => holiday.date && holiday.name)
          .map((holiday) => [holiday.date, holiday]),
      );

      const nextHolidays = state.holidays.map((holiday) => {
        const imported = importedByDate.get(holiday.date);
        if (!imported) {
          return holiday;
        }

        importedByDate.delete(holiday.date);
        return {
          ...holiday,
          name: imported.name,
        };
      });

      importedByDate.forEach((holiday) => {
        if (existingByDate.has(holiday.date)) {
          return;
        }

        nextHolidays.push({
          id: nextId++,
          date: holiday.date,
          name: holiday.name,
        });
      });

      return applyDirtyAwareUpdate(state, {
        holidays: nextHolidays,
      });
    });
  },

  addMember: () => {
    set((state) => {
      const nextId = state.members.reduce((maxId, member) => Math.max(maxId, member.id), 0) + 1;
      return applyDirtyAwareUpdate(state, {
        members: [...state.members, { id: nextId, name: `メンバー ${nextId}` }],
      });
    });
  },

  updateMember: (memberId, name) => {
    set((state) =>
      applyDirtyAwareUpdate(state, {
        members: state.members.map((member) => (member.id === memberId ? { ...member, name } : member)),
      }),
    );
  },

  deleteMember: (memberId) => {
    set((state) =>
      applyDirtyAwareUpdate(state, {
        members: state.members.filter((member) => member.id !== memberId),
      }),
    );
  },

  moveMemberUp: (memberId) => {
    set((state) =>
      applyDirtyAwareUpdate(state, {
        members: reorderMembersByStep(state.members, memberId, -1),
      }),
    );
  },

  moveMemberDown: (memberId) => {
    set((state) =>
      applyDirtyAwareUpdate(state, {
        members: reorderMembersByStep(state.members, memberId, 1),
      }),
    );
  },

  moveTaskByDays: (taskId, dayOffset) => {
    if (dayOffset === 0) {
      return;
    }

    set((state) => {
      const subtreeIds = withSubtreeTaskIds(taskId, state.tasks);
      return applyDirtyAwareUpdate(state, {
        tasks: applyTaskUpdates(
          state.tasks.map((task) =>
            subtreeIds.has(task.id) ? shiftTaskByDays(task, dayOffset) : task,
          ),
          state.holidays,
          state.excludeNonWorkingDays,
        ),
      });
    });
  },

  resizeTaskByDays: (taskId, dayOffset) => {
    if (dayOffset === 0) {
      return;
    }

    set((state) =>
      applyDirtyAwareUpdate(state, {
        tasks: applyTaskUpdates(
          state.tasks.map((task) =>
            task.id === taskId && task.type !== "milestone"
              ? resizeTaskByDays(task, dayOffset)
              : task,
          ),
          state.holidays,
          state.excludeNonWorkingDays,
        ),
      }),
    );
  },

  resizeTaskStartByDays: (taskId, dayOffset) => {
    if (dayOffset === 0) {
      return;
    }

    set((state) =>
      applyDirtyAwareUpdate(state, {
        tasks: applyTaskUpdates(
          state.tasks.map((task) =>
            task.id === taskId && task.type !== "milestone"
              ? resizeTaskStartByDays(task, dayOffset)
              : task,
          ),
          state.holidays,
          state.excludeNonWorkingDays,
        ),
      }),
    );
  },

  loadTasks: async () => {
    const previous = get();
    set({ status: "loading", error: null });

    try {
      const data = await fetchTasks();
      const persisted = normalizeLoadedState(data);
      const nextTasks = applyTaskUpdates(
        persisted.tasks,
        persisted.holidays,
        persisted.excludeNonWorkingDays,
      );
      const savedState: PersistedState = {
        ...persisted,
        tasks: nextTasks,
      };
      const savedSnapshot = serializePersistedState(buildPersistedState(savedState));

      set({
        projectName: persisted.projectName,
        projectVersion: persisted.projectVersion,
        projectStartDate: persisted.projectStartDate,
        projectEndDate: persisted.projectEndDate,
        members: persisted.members,
        tasks: nextTasks,
        dependencies: persisted.dependencies,
        holidays: persisted.holidays,
        excludeNonWorkingDays: persisted.excludeNonWorkingDays,
        pendingDependencyFromTaskId: null,
        selectedTaskId: findTaskSelection(previous.selectedTaskId, previous.tasks, nextTasks),
        collapsedTaskIds: [],
        status: "ready",
        error: null,
        savedState,
        savedSnapshot,
        hasUnsavedChanges: false,
      });
    } catch (error) {
      set({
        status: "error",
        error: error instanceof Error ? error.message : "タスクの読み込みに失敗しました。",
      });
    }
  },

  saveChanges: async () => {
    const state = get();
    const payload = buildPersistedState(state);
    const selectedTaskId = state.selectedTaskId;
    const previousTasks = state.tasks;

    set({ isSaving: true, error: null });

    try {
      const response = await saveTasks(payload);
      const persisted = normalizeLoadedState(response);
      const nextTasks = applyTaskUpdates(
        persisted.tasks,
        persisted.holidays,
        persisted.excludeNonWorkingDays,
      );
      const savedState: PersistedState = {
        ...persisted,
        tasks: nextTasks,
      };
      const savedSnapshot = serializePersistedState(buildPersistedState(savedState));

      set({
        projectName: persisted.projectName,
        projectVersion: persisted.projectVersion,
        projectStartDate: persisted.projectStartDate,
        projectEndDate: persisted.projectEndDate,
        members: persisted.members,
        tasks: nextTasks,
        dependencies: persisted.dependencies,
        holidays: persisted.holidays,
        excludeNonWorkingDays: persisted.excludeNonWorkingDays,
        selectedTaskId: findTaskSelection(selectedTaskId, previousTasks, nextTasks),
        pendingDependencyFromTaskId: null,
        collapsedTaskIds: [],
        status: "ready",
        error: null,
        isSaving: false,
        savedState,
        savedSnapshot,
        hasUnsavedChanges: false,
      });
    } catch (error) {
      set({
        isSaving: false,
        status: "error",
        error: error instanceof Error ? error.message : "保存に失敗しました。",
      });
    }
  },

  discardChanges: () => {
    const state = get();
    if (!state.savedState) {
      return;
    }

    set(restoreSavedState(state.savedState, state.selectedTaskId, state.tasks));
  },
}));
