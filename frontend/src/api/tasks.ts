import type {
  Dependency,
  Holiday,
  Member,
  ProjectSummary,
  ProjectVersionSummary,
  Task,
} from "@/models/gantt";

export type GanttResponse = {
  projectId: number;
  projectName: string;
  version: number;
  projectStartDate: string;
  projectEndDate: string;
  excludeNonWorkingDays: boolean;
  members: Member[];
  tasks: Task[];
  dependencies: Dependency[];
  holidays: Holiday[];
};

export type SaveGanttPayload = {
  projectName: string;
  version: number;
  projectStartDate: string;
  projectEndDate: string;
  excludeNonWorkingDays: boolean;
  members: Member[];
  tasks: Task[];
  dependencies: Dependency[];
  holidays: Holiday[];
};

export type CreateProjectPayload = {
  name: string;
  sourceProjectId: number | null;
  copyBasicSettings: boolean;
  copyTasks: boolean;
  copyDependencies: boolean;
  copyHolidays: boolean;
  copyMembers: boolean;
};

function normalizeTasks(tasks: Task[]): Task[] {
  return tasks.map((task) => ({
    ...task,
    parentTaskId: task.parentTaskId ?? null,
    type: task.type ?? "task",
  }));
}

function normalizeResponse(data: GanttResponse): GanttResponse {
  return {
    ...data,
    projectId: Number(data.projectId) || 1,
    projectName: data.projectName || "チーム進行ガントチャート",
    version: Math.max(1, Number(data.version) || 1),
    excludeNonWorkingDays: Boolean(data.excludeNonWorkingDays),
    members: data.members ?? [],
    tasks: normalizeTasks(data.tasks ?? []),
    dependencies: data.dependencies ?? [],
    holidays: data.holidays ?? [],
  };
}

export async function fetchTasks(projectId: number): Promise<GanttResponse> {
  const response = await fetch(`/api/tasks?projectId=${projectId}`);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const data = (await response.json()) as GanttResponse;
  return normalizeResponse(data);
}

export async function saveTasks(projectId: number, payload: SaveGanttPayload): Promise<GanttResponse> {
  const response = await fetch(`/api/tasks?projectId=${projectId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const data = (await response.json()) as GanttResponse;
  return normalizeResponse(data);
}

export async function fetchProjectVersions(projectId: number): Promise<ProjectVersionSummary[]> {
  const response = await fetch(`/api/tasks/versions?projectId=${projectId}`);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const data = (await response.json()) as ProjectVersionSummary[];
  return data.map((item) => ({
    ...item,
    note: item.note ?? null,
  }));
}

export async function restoreProjectVersion(projectId: number, version: number): Promise<GanttResponse> {
  const response = await fetch(`/api/tasks/versions/${version}/restore?projectId=${projectId}`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const data = (await response.json()) as GanttResponse;
  return normalizeResponse(data);
}

export async function fetchProjects(): Promise<ProjectSummary[]> {
  const response = await fetch("/api/projects");
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const data = (await response.json()) as ProjectSummary[];
  return data;
}

export async function createProject(payload: CreateProjectPayload): Promise<ProjectSummary> {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return (await response.json()) as ProjectSummary;
}

export async function deleteProject(projectId: number): Promise<void> {
  const response = await fetch(`/api/projects/${projectId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
}
