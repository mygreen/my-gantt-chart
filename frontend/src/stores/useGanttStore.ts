import { create } from "zustand";
import {
  createProject as createProjectRequest,
  deleteProject as deleteProjectRequest,
  fetchProjects,
  fetchProjectVersions,
  fetchSystemHolidays,
  fetchTasks,
  restoreProjectVersion,
  saveTasks,
  saveSystemHolidays,
  type CreateProjectPayload,
  type GanttResponse,
  type SaveGanttPayload,
} from "@/api/tasks";
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
  ProjectSummary,
  ProjectVersionSummary,
  Task,
  TaskType,
  TimelineScale,
  Viewport,
} from "@/models/gantt";

type AddTaskMode = "child" | "sibling" | "tail";
type StoreStatus = "idle" | "loading" | "ready" | "error";

type PersistedState = {
  projectName: string;
  projectVersion: number;
  projectStartDate: string;
  projectEndDate: string;
  excludeNonWorkingDays: boolean;
  members: Member[];
  tasks: Task[];
  dependencies: Dependency[];
  projectHolidays: Holiday[];
};

type UiPreferences = {
  showOwnerInSidebar: boolean;
  showStartDateInSidebar: boolean;
  showEndDateInSidebar: boolean;
  showProgressInSidebar: boolean;
  showBaseline: boolean;
  baselineDate: string;
};

type StoredUiPreferences = {
  byProject: Record<string, UiPreferences>;
};

type GanttState = {
  selectedProjectId: number;
  projects: ProjectSummary[];
  projectName: string;
  projectVersion: number;
  projectStartDate: string;
  projectEndDate: string;
  members: Member[];
  tasks: Task[];
  dependencies: Dependency[];
  holidays: Holiday[];
  projectHolidays: Holiday[];
  systemHolidays: Holiday[];
  versionHistory: ProjectVersionSummary[];
  viewport: Viewport;
  showOwnerInSidebar: boolean;
  showStartDateInSidebar: boolean;
  showEndDateInSidebar: boolean;
  showProgressInSidebar: boolean;
  showBaseline: boolean;
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
  loadProjects: () => Promise<void>;
  switchProject: (projectId: number) => Promise<void>;
  createProject: (payload: CreateProjectPayload) => Promise<void>;
  deleteProject: (projectId: number) => Promise<void>;
  setProjectName: (name: string) => void;
  setProjectSchedule: (startDate: string, endDate: string) => void;
  loadTasks: (projectId?: number) => Promise<void>;
  saveChanges: () => Promise<void>;
  loadVersionHistory: () => Promise<void>;
  restoreVersion: (version: number) => Promise<void>;
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
  toggleSidebarProgressVisibility: () => void;
  setBaselineEnabled: (enabled: boolean) => void;
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
  addSystemHoliday: () => void;
  updateSystemHoliday: (holidayId: number, updates: Pick<Holiday, "date" | "name">) => void;
  deleteSystemHoliday: (holidayId: number) => void;
  importSystemHolidays: (holidays: Array<Pick<Holiday, "date" | "name">>) => void;
  saveSystemHolidayChanges: () => Promise<void>;
  loadSystemHolidays: () => Promise<void>;
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
  | "projectHolidays"
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

function mergeHolidays(systemHolidays: Holiday[], projectHolidays: Holiday[]) {
  const byDate = new Map<string, Holiday>();
  systemHolidays.forEach((holiday) => {
    byDate.set(holiday.date, holiday);
  });
  projectHolidays.forEach((holiday) => {
    byDate.set(holiday.date, holiday);
  });
  return Array.from(byDate.values()).sort((left, right) => left.date.localeCompare(right.date));
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
    holidays: source.projectHolidays.map((holiday) => ({ ...holiday })),
  };
}

const UI_PREFERENCES_STORAGE_KEY = "mygantt.uiPreferences";

function createDefaultUiPreferences(): UiPreferences {
  return {
    showOwnerInSidebar: true,
    showStartDateInSidebar: false,
    showEndDateInSidebar: false,
    showProgressInSidebar: false,
    showBaseline: false,
    baselineDate: "",
  };
}

function loadStoredUiPreferences(): StoredUiPreferences {
  if (typeof window === "undefined") {
    return { byProject: {} };
  }

  try {
    const raw = window.localStorage.getItem(UI_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return { byProject: {} };
    }

    const parsed = JSON.parse(raw) as StoredUiPreferences;
    return {
      byProject: parsed?.byProject ?? {},
    };
  } catch {
    return { byProject: {} };
  }
}

function loadUiPreferences(projectId: number): UiPreferences {
  const stored = loadStoredUiPreferences();
  return {
    ...createDefaultUiPreferences(),
    ...(stored.byProject[String(projectId)] ?? {}),
  };
}

function saveUiPreferences(projectId: number, preferences: UiPreferences) {
  if (typeof window === "undefined") {
    return;
  }

  const stored = loadStoredUiPreferences();
  stored.byProject[String(projectId)] = preferences;
  window.localStorage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify(stored));
}

function buildUiPreferences(state: Pick<
  GanttState,
  | "showOwnerInSidebar"
  | "showStartDateInSidebar"
  | "showEndDateInSidebar"
  | "showProgressInSidebar"
  | "showBaseline"
  | "baselineDate"
>) {
  return {
    showOwnerInSidebar: state.showOwnerInSidebar,
    showStartDateInSidebar: state.showStartDateInSidebar,
    showEndDateInSidebar: state.showEndDateInSidebar,
    showProgressInSidebar: state.showProgressInSidebar,
    showBaseline: state.showBaseline,
    baselineDate: state.baselineDate,
  } satisfies UiPreferences;
}

function persistUiPreferences(
  projectId: number,
  state: Pick<
    GanttState,
    | "showOwnerInSidebar"
    | "showStartDateInSidebar"
    | "showEndDateInSidebar"
    | "showProgressInSidebar"
    | "showBaseline"
    | "baselineDate"
  >,
) {
  saveUiPreferences(projectId, buildUiPreferences(state));
}

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
    projectHolidays: (data.projectHolidays ?? []).map((holiday) => ({ ...holiday })),
  };
}

function getFallbackProjectId(projects: ProjectSummary[], preferredProjectId: number | null) {
  if (preferredProjectId !== null && projects.some((project) => project.id === preferredProjectId)) {
    return preferredProjectId;
  }

  return projects[0]?.id ?? 1;
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
  systemHolidays: Holiday[],
  selectedTaskId: number | null,
  currentTasks: Task[],
): Partial<GanttState> {
  const nextTasks = applyTaskUpdates(
    savedState.tasks,
    mergeHolidays(systemHolidays, savedState.projectHolidays),
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
    projectHolidays: savedState.projectHolidays,
    holidays: mergeHolidays(systemHolidays, savedState.projectHolidays),
    excludeNonWorkingDays: savedState.excludeNonWorkingDays,
    selectedTaskId: findTaskSelection(selectedTaskId, currentTasks, nextTasks),
    pendingDependencyFromTaskId: null,
    collapsedTaskIds: [],
    hasUnsavedChanges: false,
  };
}

function buildLoadedStateUpdate(
  projectId: number,
  persisted: PersistedState,
  systemHolidays: Holiday[],
  previousSelectedTaskId: number | null,
  previousTasks: Task[],
) {
  const nextTasks = applyTaskUpdates(
    persisted.tasks,
    mergeHolidays(systemHolidays, persisted.projectHolidays),
    persisted.excludeNonWorkingDays,
  );
  const savedState: PersistedState = {
    ...persisted,
    tasks: nextTasks,
  };
  const savedSnapshot = serializePersistedState(buildPersistedState(savedState));

  return {
    selectedProjectId: projectId,
    projectName: persisted.projectName,
    projectVersion: persisted.projectVersion,
    projectStartDate: persisted.projectStartDate,
    projectEndDate: persisted.projectEndDate,
    members: persisted.members,
    tasks: nextTasks,
    dependencies: persisted.dependencies,
    projectHolidays: persisted.projectHolidays,
    holidays: mergeHolidays(systemHolidays, persisted.projectHolidays),
    excludeNonWorkingDays: persisted.excludeNonWorkingDays,
    pendingDependencyFromTaskId: null,
    selectedTaskId: findTaskSelection(previousSelectedTaskId, previousTasks, nextTasks),
    collapsedTaskIds: [],
    status: "ready" as const,
    error: null,
    savedState,
    savedSnapshot,
    hasUnsavedChanges: false,
  };
}

export const useGanttStore = create<GanttState>((set, get) => ({
  projectName: "チーム進行ガントチャート",
  selectedProjectId: 1,
  projects: [],
  projectVersion: 1,
  projectStartDate: getTodayDateString(),
  projectEndDate: getTodayDateString(),
  members: [],
  tasks: [],
  dependencies: [],
  holidays: [],
  projectHolidays: [],
  systemHolidays: [],
  versionHistory: [],
  viewport: defaultViewport,
  showOwnerInSidebar: true,
  showStartDateInSidebar: false,
  showEndDateInSidebar: false,
  showProgressInSidebar: false,
  showBaseline: false,
  showAllParentTaskOptions: false,
  excludeNonWorkingDays: false,
  timelineScale: "day",
  baselineDate: "",
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
    set((state) => {
      const next = {
        showOwnerInSidebar: !state.showOwnerInSidebar,
      };
      persistUiPreferences(state.selectedProjectId, { ...state, ...next });
      return next;
    });
  },

  toggleSidebarStartDateVisibility: () => {
    set((state) => {
      const next = {
        showStartDateInSidebar: !state.showStartDateInSidebar,
      };
      persistUiPreferences(state.selectedProjectId, { ...state, ...next });
      return next;
    });
  },

  toggleSidebarEndDateVisibility: () => {
    set((state) => {
      const next = {
        showEndDateInSidebar: !state.showEndDateInSidebar,
      };
      persistUiPreferences(state.selectedProjectId, { ...state, ...next });
      return next;
    });
  },

  toggleSidebarProgressVisibility: () => {
    set((state) => {
      const next = {
        showProgressInSidebar: !state.showProgressInSidebar,
      };
      persistUiPreferences(state.selectedProjectId, { ...state, ...next });
      return next;
    });
  },

  setBaselineEnabled: (enabled) => {
    set((state) => {
      const nextBaselineDate =
        enabled && !state.baselineDate ? getTodayDateString() : state.baselineDate;
      const next = {
        showBaseline: enabled,
        baselineDate: nextBaselineDate,
      };
      persistUiPreferences(state.selectedProjectId, { ...state, ...next });
      return next;
    });
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
    set((state) => {
      const next = { baselineDate };
      persistUiPreferences(state.selectedProjectId, { ...state, ...next });
      return next;
    });
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
      const effectiveMode =
        mode === "child" && selectedTask?.type === "milestone" ? "tail" : mode;
      const parentTaskId =
        effectiveMode === "child"
          ? (selectedTask?.id ?? null)
          : effectiveMode === "sibling"
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

      const nextTasks = insertTaskByMode(
        state.tasks,
        newTask,
        effectiveMode,
        state.selectedTaskId,
      );
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
      const nextId =
        state.projectHolidays.reduce((maxId, holiday) => Math.max(maxId, holiday.id), 0) + 1;
      const projectHolidays = [
        ...state.projectHolidays,
        {
          id: nextId,
          date: state.projectStartDate,
          name: "新しい休日",
        },
      ];
      return applyDirtyAwareUpdate(state, {
        projectHolidays,
        holidays: mergeHolidays(state.systemHolidays, projectHolidays),
      });
    });
  },

  updateHoliday: (holidayId, updates) => {
    set((state) => {
      const projectHolidays = state.projectHolidays.map((holiday) =>
        holiday.id === holidayId ? { ...holiday, ...updates } : holiday,
      );
      return applyDirtyAwareUpdate(state, {
        projectHolidays,
        holidays: mergeHolidays(state.systemHolidays, projectHolidays),
      });
    });
  },

  deleteHoliday: (holidayId) => {
    set((state) => {
      const projectHolidays = state.projectHolidays.filter((holiday) => holiday.id !== holidayId);
      return applyDirtyAwareUpdate(state, {
        projectHolidays,
        holidays: mergeHolidays(state.systemHolidays, projectHolidays),
      });
    });
  },

  importHolidays: (holidays) => {
    set((state) => {
      let nextId =
        state.projectHolidays.reduce((maxId, holiday) => Math.max(maxId, holiday.id), 0) + 1;
      const existingByDate = new Map(
        state.projectHolidays.map((holiday) => [holiday.date, holiday]),
      );
      const importedByDate = new Map(
        holidays
          .filter((holiday) => holiday.date && holiday.name)
          .map((holiday) => [holiday.date, holiday]),
      );

      const projectHolidays = state.projectHolidays.map((holiday) => {
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

        projectHolidays.push({
          id: nextId++,
          date: holiday.date,
          name: holiday.name,
        });
      });

      return applyDirtyAwareUpdate(state, {
        projectHolidays,
        holidays: mergeHolidays(state.systemHolidays, projectHolidays),
      });
    });
  },

  addSystemHoliday: () => {
    set((state) => {
      const nextId =
        state.systemHolidays.reduce((maxId, holiday) => Math.max(maxId, holiday.id), 0) + 1;
      const systemHolidays = [
        ...state.systemHolidays,
        {
          id: nextId,
          date: state.projectStartDate,
          name: "新しい祝日",
        },
      ];
      return {
        systemHolidays,
        holidays: mergeHolidays(systemHolidays, state.projectHolidays),
      };
    });
  },

  updateSystemHoliday: (holidayId, updates) => {
    set((state) => {
      const systemHolidays = state.systemHolidays.map((holiday) =>
        holiday.id === holidayId ? { ...holiday, ...updates } : holiday,
      );
      return {
        systemHolidays,
        holidays: mergeHolidays(systemHolidays, state.projectHolidays),
      };
    });
  },

  deleteSystemHoliday: (holidayId) => {
    set((state) => {
      const systemHolidays = state.systemHolidays.filter((holiday) => holiday.id !== holidayId);
      return {
        systemHolidays,
        holidays: mergeHolidays(systemHolidays, state.projectHolidays),
      };
    });
  },

  importSystemHolidays: (holidays) => {
    set((state) => {
      let nextId =
        state.systemHolidays.reduce((maxId, holiday) => Math.max(maxId, holiday.id), 0) + 1;
      const existingByDate = new Map(
        state.systemHolidays.map((holiday) => [holiday.date, holiday]),
      );
      const importedByDate = new Map(
        holidays
          .filter((holiday) => holiday.date && holiday.name)
          .map((holiday) => [holiday.date, holiday]),
      );

      const systemHolidays = state.systemHolidays.map((holiday) => {
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

        systemHolidays.push({
          id: nextId++,
          date: holiday.date,
          name: holiday.name,
        });
      });

      return {
        systemHolidays,
        holidays: mergeHolidays(systemHolidays, state.projectHolidays),
      };
    });
  },

  saveSystemHolidayChanges: async () => {
    const state = get();
    set({ status: "loading", error: null });

    try {
      const systemHolidays = await saveSystemHolidays(
        state.systemHolidays.map((holiday) => ({
          id: holiday.id,
          date: holiday.date,
          name: holiday.name,
        })),
      );

      set({
        status: "ready",
        systemHolidays,
        holidays: mergeHolidays(systemHolidays, get().projectHolidays),
      });
    } catch (error) {
      set({
        status: "error",
        error: error instanceof Error ? error.message : "保存に失敗しました。",
      });
    }
  },

  loadSystemHolidays: async () => {
    try {
      const systemHolidays = await fetchSystemHolidays();
      set((state) => ({
        systemHolidays,
        holidays: mergeHolidays(systemHolidays, state.projectHolidays),
      }));
    } catch (error) {
      set({
        status: "error",
        error: error instanceof Error ? error.message : "祝日設定の読み込みに失敗しました。",
      });
    }
  },

  addMember: () => {
    set((state) => {
      const nextId = state.members.reduce((maxId, member) => Math.max(maxId, member.id), 0) + 1;
      return applyDirtyAwareUpdate(state, {
        members: [...state.members, { id: nextId, name: `新規メンバー ${nextId}` }],
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

  loadProjects: async () => {
    const current = get();

    try {
      const projects = await fetchProjects();
      set({
        projects,
        selectedProjectId: getFallbackProjectId(projects, current.selectedProjectId),
      });
      await get().loadSystemHolidays();
    } catch (error) {
      set({
        status: "error",
        error: error instanceof Error ? error.message : "プロジェクト一覧の読み込みに失敗しました。",
      });
    }
  },

  switchProject: async (projectId) => {
    await get().loadTasks(projectId);
  },

  createProject: async (payload) => {
    set({ status: "loading", error: null });

    try {
      const project = await createProjectRequest(payload);
      const projects = await fetchProjects();
      set({
        projects,
        selectedProjectId: project.id,
      });
      await get().loadTasks(project.id);
    } catch (error) {
      set({
        status: "error",
        error: error instanceof Error ? error.message : "プロジェクトの追加に失敗しました。",
      });
    }
  },

  deleteProject: async (projectId) => {
    const state = get();
    set({ status: "loading", error: null });

    try {
      await deleteProjectRequest(projectId);
      const projects = await fetchProjects();
      const nextProjectId = getFallbackProjectId(
        projects,
        state.selectedProjectId === projectId ? null : state.selectedProjectId,
      );
      set({
        projects,
        selectedProjectId: nextProjectId,
      });
      await get().loadTasks(nextProjectId);
    } catch (error) {
      set({
        status: "error",
        error: error instanceof Error ? error.message : "プロジェクトの削除に失敗しました。",
      });
    }
  },

  loadTasks: async (projectId) => {
    const previous = get();
    const targetProjectId = projectId ?? previous.selectedProjectId;
    set({ status: "loading", error: null });

    try {
      const [projects, data, versionHistory, systemHolidays] = await Promise.all([
        fetchProjects(),
        fetchTasks(targetProjectId),
        fetchProjectVersions(targetProjectId),
        fetchSystemHolidays(),
      ]);
      const persisted = normalizeLoadedState(data);
      const uiPreferences = loadUiPreferences(targetProjectId);

      set({
        ...buildLoadedStateUpdate(
          targetProjectId,
          persisted,
          systemHolidays,
          previous.selectedTaskId,
          previous.tasks,
        ),
        projects,
        systemHolidays,
        versionHistory,
        showOwnerInSidebar: uiPreferences.showOwnerInSidebar,
        showStartDateInSidebar: uiPreferences.showStartDateInSidebar,
        showEndDateInSidebar: uiPreferences.showEndDateInSidebar,
        showProgressInSidebar: uiPreferences.showProgressInSidebar,
        showBaseline: uiPreferences.showBaseline,
        baselineDate: uiPreferences.baselineDate,
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
      const response = await saveTasks(state.selectedProjectId, payload);
      const persisted = normalizeLoadedState(response);
      const [projects, versionHistory, systemHolidays] = await Promise.all([
        fetchProjects(),
        fetchProjectVersions(state.selectedProjectId),
        fetchSystemHolidays(),
      ]);

      set({
        ...buildLoadedStateUpdate(
          state.selectedProjectId,
          persisted,
          systemHolidays,
          selectedTaskId,
          previousTasks,
        ),
        isSaving: false,
        projects,
        systemHolidays,
        versionHistory,
      });
    } catch (error) {
      set({
        isSaving: false,
        status: "error",
        error: error instanceof Error ? error.message : "保存に失敗しました。",
      });
    }
  },

  loadVersionHistory: async () => {
    try {
      const versionHistory = await fetchProjectVersions(get().selectedProjectId);
      set({ versionHistory });
    } catch (error) {
      set({
        status: "error",
        error: error instanceof Error ? error.message : "バージョン一覧の読み込みに失敗しました。",
      });
    }
  },

  restoreVersion: async (version) => {
    const state = get();
    set({ status: "loading", error: null });

    try {
      const response = await restoreProjectVersion(state.selectedProjectId, version);
      const persisted = normalizeLoadedState(response);
      const [projects, versionHistory, systemHolidays] = await Promise.all([
        fetchProjects(),
        fetchProjectVersions(state.selectedProjectId),
        fetchSystemHolidays(),
      ]);

      set({
        ...buildLoadedStateUpdate(
          state.selectedProjectId,
          persisted,
          systemHolidays,
          state.selectedTaskId,
          state.tasks,
        ),
        projects,
        systemHolidays,
        versionHistory,
      });
    } catch (error) {
      set({
        status: "error",
        error: error instanceof Error ? error.message : "バージョンの復元に失敗しました。",
      });
    }
  },

  discardChanges: () => {
    const state = get();
    if (!state.savedState) {
      return;
    }

    set(restoreSavedState(state.savedState, state.systemHolidays, state.selectedTaskId, state.tasks));
  },
}));



