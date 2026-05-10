import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUp,
  CalendarDays,
  CalendarRange,
  Check,
  Diamond,
  FilePlus2,
  FolderPlus,
  GitBranch,
  History,
  MoveHorizontal,
  Printer,
  RefreshCw,
  RotateCcw,
  Rows3,
  Save,
  Settings2,
  Trash2,
  Upload,
  UserRound,
  Users,
} from "lucide-react";
import { GanttBoard } from "@/components/gantt/GanttBoard";
import { exportGanttAsSvg } from "@/core/export/ganttSvg";
import { buildVisibleTasks } from "@/core/taskTree";
import type { Holiday, Task, TimelineScale } from "@/models/gantt";
import { useGanttStore } from "@/stores/useGanttStore";
import { cn } from "@/utils/cn";

type SidebarSection = "project" | "system";
type AppView =
  | "gantt"
  | "project"
  | "members"
  | "projectHoliday"
  | "versions"
  | "projectAdmin"
  | "systemHoliday";

const timelineScaleOptions: Array<{ value: TimelineScale; label: string }> = [
  { value: "day", label: "日" },
  { value: "week", label: "週" },
  { value: "month", label: "月" },
];

const projectViews: Array<{
  id: AppView;
  label: string;
  icon: typeof CalendarRange;
}> = [
  { id: "gantt", label: "ガントチャート", icon: CalendarRange },
  { id: "project", label: "基本設定", icon: Settings2 },
  { id: "members", label: "メンバー設定", icon: Users },
  { id: "projectHoliday", label: "プロジェクト休日", icon: CalendarDays },
  { id: "versions", label: "バージョン管理", icon: History },
];

const systemViews: Array<{
  id: AppView;
  label: string;
  icon: typeof CalendarRange;
}> = [
  { id: "projectAdmin", label: "プロジェクト管理", icon: Settings2 },
  { id: "systemHoliday", label: "祝日設定", icon: CalendarDays },
];

const SVG_EXPORT_PERIOD_STORAGE_KEY = "mygantt.svgExportPeriod";

type StoredSvgExportPeriods = {
  byProject: Record<string, { startDate: string; endDate: string }>;
};

function loadStoredSvgExportPeriods(): StoredSvgExportPeriods {
  if (typeof window === "undefined") {
    return { byProject: {} };
  }

  try {
    const raw = window.localStorage.getItem(SVG_EXPORT_PERIOD_STORAGE_KEY);
    if (!raw) {
      return { byProject: {} };
    }

    const parsed = JSON.parse(raw) as StoredSvgExportPeriods;
    return {
      byProject: parsed?.byProject ?? {},
    };
  } catch {
    return { byProject: {} };
  }
}

function loadStoredSvgExportPeriod(projectId: number) {
  return loadStoredSvgExportPeriods().byProject[String(projectId)] ?? null;
}

function saveStoredSvgExportPeriod(projectId: number, startDate: string, endDate: string) {
  if (typeof window === "undefined") {
    return;
  }

  const stored = loadStoredSvgExportPeriods();
  stored.byProject[String(projectId)] = { startDate, endDate };
  window.localStorage.setItem(SVG_EXPORT_PERIOD_STORAGE_KEY, JSON.stringify(stored));
}

function buildParentTaskCandidates(
  tasks: Task[],
  selectedTask: Task,
  showAllParentTaskOptions: boolean,
) {
  const baseCandidates = tasks.filter(
    (task) => task.id !== selectedTask.id && task.type !== "milestone",
  );

  if (showAllParentTaskOptions) {
    return baseCandidates;
  }

  return baseCandidates.filter(
    (task) => (task.parentTaskId ?? null) === (selectedTask.parentTaskId ?? null),
  );
}

async function parseHolidayUpload(file: File) {
  const buffer = await file.arrayBuffer();
  const utf8Text = new TextDecoder("utf-8").decode(buffer);
  const text = utf8Text.includes("国民の祝日")
    ? utf8Text
    : new TextDecoder("shift_jis").decode(buffer);
  const trimmed = text.trim();

  if (!trimmed) {
    return [] as Array<Pick<Holiday, "date" | "name">>;
  }

  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as Array<{ date?: string; name?: string }>;
    return parsed
      .filter((holiday) => holiday.date && holiday.name)
      .map((holiday) => ({
        date: holiday.date as string,
        name: holiday.name as string,
      }));
  }

  const normalizeHolidayDate = (date: string) => {
    const [year, month, day] = date.trim().replace(/^\uFEFF/, "").split("/");
    if (!year || !month || !day) {
      return "";
    }

    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  };

  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith("国民の祝日・休日月日"))
    .map((line) => {
      const [date, name] = line.split(",").map((part) => part.trim());
      return {
        date: normalizeHolidayDate(date),
        name,
      };
    })
    .filter((holiday) => holiday.date && holiday.name);
}

export function App() {
  const [activeView, setActiveView] = useState<AppView>("gantt");
  const [sidebarSection, setSidebarSection] = useState<SidebarSection>("project");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [sourceProjectId, setSourceProjectId] = useState<number | null>(null);
  const [copyBasicSettings, setCopyBasicSettings] = useState(true);
  const [copyTasks, setCopyTasks] = useState(false);
  const [copyDependencies, setCopyDependencies] = useState(false);
  const [copyHolidays, setCopyHolidays] = useState(true);
  const [copyMembers, setCopyMembers] = useState(true);
  const [isSvgExportDialogOpen, setIsSvgExportDialogOpen] = useState(false);
  const [svgExportStartDate, setSvgExportStartDate] = useState("");
  const [svgExportEndDate, setSvgExportEndDate] = useState("");
  const [svgExportShowOwner, setSvgExportShowOwner] = useState(false);
  const [svgExportShowStartDate, setSvgExportShowStartDate] = useState(false);
  const [svgExportShowEndDate, setSvgExportShowEndDate] = useState(false);
  const [svgExportShowProgress, setSvgExportShowProgress] = useState(false);
  const holidayUploadRef = useRef<HTMLInputElement | null>(null);
  const systemHolidayUploadRef = useRef<HTMLInputElement | null>(null);

  const selectedProjectId = useGanttStore((state) => state.selectedProjectId);
  const projects = useGanttStore((state) => state.projects);
  const projectName = useGanttStore((state) => state.projectName);
  const projectVersion = useGanttStore((state) => state.projectVersion);
  const projectStartDate = useGanttStore((state) => state.projectStartDate);
  const projectEndDate = useGanttStore((state) => state.projectEndDate);
  const members = useGanttStore((state) => state.members);
  const tasks = useGanttStore((state) => state.tasks);
  const dependencies = useGanttStore((state) => state.dependencies);
  const holidays = useGanttStore((state) => state.holidays);
  const projectHolidays = useGanttStore((state) => state.projectHolidays);
  const systemHolidays = useGanttStore((state) => state.systemHolidays);
  const versionHistory = useGanttStore((state) => state.versionHistory);
  const switchProject = useGanttStore((state) => state.switchProject);
  const loadTasks = useGanttStore((state) => state.loadTasks);
  const loadProjects = useGanttStore((state) => state.loadProjects);
  const loadVersionHistory = useGanttStore((state) => state.loadVersionHistory);
  const saveChanges = useGanttStore((state) => state.saveChanges);
  const createProject = useGanttStore((state) => state.createProject);
  const deleteProject = useGanttStore((state) => state.deleteProject);
  const restoreVersion = useGanttStore((state) => state.restoreVersion);
  const discardChanges = useGanttStore((state) => state.discardChanges);
  const addTask = useGanttStore((state) => state.addTask);
  const deleteTask = useGanttStore((state) => state.deleteTask);
  const moveTaskUp = useGanttStore((state) => state.moveTaskUp);
  const moveTaskDown = useGanttStore((state) => state.moveTaskDown);
  const status = useGanttStore((state) => state.status);
  const error = useGanttStore((state) => state.error);
  const hasUnsavedChanges = useGanttStore((state) => state.hasUnsavedChanges);
  const isSaving = useGanttStore((state) => state.isSaving);
  const interactionMode = useGanttStore((state) => state.interactionMode);
  const pendingDependencyFromTaskId = useGanttStore((state) => state.pendingDependencyFromTaskId);
  const selectedTaskId = useGanttStore((state) => state.selectedTaskId);
  const collapsedTaskIds = useGanttStore((state) => state.collapsedTaskIds);
  const showOwnerInSidebar = useGanttStore((state) => state.showOwnerInSidebar);
  const showStartDateInSidebar = useGanttStore((state) => state.showStartDateInSidebar);
  const showEndDateInSidebar = useGanttStore((state) => state.showEndDateInSidebar);
  const showProgressInSidebar = useGanttStore((state) => state.showProgressInSidebar);
  const showBaseline = useGanttStore((state) => state.showBaseline);
  const showAllParentTaskOptions = useGanttStore((state) => state.showAllParentTaskOptions);
  const excludeNonWorkingDays = useGanttStore((state) => state.excludeNonWorkingDays);
  const timelineScale = useGanttStore((state) => state.timelineScale);
  const baselineDate = useGanttStore((state) => state.baselineDate);
  const setProjectName = useGanttStore((state) => state.setProjectName);
  const setProjectSchedule = useGanttStore((state) => state.setProjectSchedule);
  const setInteractionMode = useGanttStore((state) => state.setInteractionMode);
  const toggleSidebarOwnerVisibility = useGanttStore((state) => state.toggleSidebarOwnerVisibility);
  const toggleSidebarStartDateVisibility = useGanttStore(
    (state) => state.toggleSidebarStartDateVisibility,
  );
  const toggleSidebarEndDateVisibility = useGanttStore(
    (state) => state.toggleSidebarEndDateVisibility,
  );
  const toggleSidebarProgressVisibility = useGanttStore(
    (state) => state.toggleSidebarProgressVisibility,
  );
  const toggleAllParentTaskOptionsVisibility = useGanttStore(
    (state) => state.toggleAllParentTaskOptionsVisibility,
  );
  const toggleNonWorkingDayExclusion = useGanttStore(
    (state) => state.toggleNonWorkingDayExclusion,
  );
  const setTimelineScale = useGanttStore((state) => state.setTimelineScale);
  const setBaselineEnabled = useGanttStore((state) => state.setBaselineEnabled);
  const setBaselineDate = useGanttStore((state) => state.setBaselineDate);
  const updateTaskDetails = useGanttStore((state) => state.updateTaskDetails);
  const updateTaskSchedule = useGanttStore((state) => state.updateTaskSchedule);
  const setTaskParent = useGanttStore((state) => state.setTaskParent);
  const addHoliday = useGanttStore((state) => state.addHoliday);
  const updateHoliday = useGanttStore((state) => state.updateHoliday);
  const deleteHoliday = useGanttStore((state) => state.deleteHoliday);
  const importHolidays = useGanttStore((state) => state.importHolidays);
  const addSystemHoliday = useGanttStore((state) => state.addSystemHoliday);
  const updateSystemHoliday = useGanttStore((state) => state.updateSystemHoliday);
  const deleteSystemHoliday = useGanttStore((state) => state.deleteSystemHoliday);
  const importSystemHolidays = useGanttStore((state) => state.importSystemHolidays);
  const saveSystemHolidayChanges = useGanttStore((state) => state.saveSystemHolidayChanges);
  const loadSystemHolidays = useGanttStore((state) => state.loadSystemHolidays);
  const addMember = useGanttStore((state) => state.addMember);
  const updateMember = useGanttStore((state) => state.updateMember);
  const deleteMember = useGanttStore((state) => state.deleteMember);
  const moveMemberUp = useGanttStore((state) => state.moveMemberUp);
  const moveMemberDown = useGanttStore((state) => state.moveMemberDown);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const isSelectedMilestone = selectedTask?.type === "milestone";
  const selectedTaskHasChildren = selectedTask
    ? tasks.some((task) => task.parentTaskId === selectedTask.id)
    : false;
  const parentTaskCandidates = useMemo(
    () =>
      selectedTask && !isSelectedMilestone
        ? buildParentTaskCandidates(tasks, selectedTask, showAllParentTaskOptions)
        : [],
    [isSelectedMilestone, selectedTask, showAllParentTaskOptions, tasks],
  );
  const memberNames = useMemo(() => members.map((member) => member.name), [members]);
  const visibleViews = sidebarSection === "project" ? projectViews : systemViews;
  const hasSvgExportRange = svgExportStartDate.length > 0 && svgExportEndDate.length > 0;

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (activeView === "versions") {
      void loadVersionHistory();
    }
  }, [activeView, loadVersionHistory, selectedProjectId]);

  useEffect(() => {
    if (projects.length > 0 && sourceProjectId === null) {
      setSourceProjectId(selectedProjectId);
    }
  }, [projects, selectedProjectId, sourceProjectId]);

  const handleHolidayUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const parsed = await parseHolidayUpload(file);
      importHolidays(parsed);
    } finally {
      event.target.value = "";
    }
  };

  const handleSystemHolidayUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const parsed = await parseHolidayUpload(file);
      importSystemHolidays(parsed);
    } finally {
      event.target.value = "";
    }
  };

  const handleSidebarSectionChange = (nextSection: SidebarSection) => {
    setSidebarSection(nextSection);
    const nextViews = nextSection === "project" ? projectViews : systemViews;
    if (!nextViews.some((view) => view.id === activeView)) {
      setActiveView(nextViews[0].id);
    }
  };

  const handleSave = async () => {
    if (!window.confirm("現在の編集内容を保存しますか？")) {
      return;
    }

    await saveChanges();
  };

  const handleDiscard = () => {
    if (!window.confirm("保存していない変更を破棄しますか？")) {
      return;
    }

    discardChanges();
  };

  const handleReload = async () => {
    const message = hasUnsavedChanges
      ? "最新の保存状態を再読み込みしますか？ 保存していない変更は破棄されます。"
      : "最新の保存状態を再読み込みしますか？";

    if (!window.confirm(message)) {
      return;
    }

    await loadTasks();
  };

  const handleProjectSwitch = async (nextProjectId: number) => {
    if (nextProjectId === selectedProjectId) {
      return;
    }

    if (
      hasUnsavedChanges &&
      !window.confirm("保存していない変更を破棄して、別プロジェクトへ切り替えますか？")
    ) {
      return;
    }

    await switchProject(nextProjectId);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      window.alert("プロジェクト名を入力してください。");
      return;
    }

    if (!window.confirm("新しいプロジェクトを追加しますか？")) {
      return;
    }

    await createProject({
      name: newProjectName.trim(),
      sourceProjectId,
      copyBasicSettings,
      copyTasks,
      copyDependencies: copyTasks && copyDependencies,
      copyHolidays,
      copyMembers,
    });

    setNewProjectName("");
    setCopyBasicSettings(true);
    setCopyTasks(false);
    setCopyDependencies(false);
    setCopyHolidays(true);
    setCopyMembers(true);
    setActiveView("gantt");
  };

  const handleDeleteProject = async (projectId: number) => {
    const target = projects.find((project) => project.id === projectId);
    if (!target) {
      return;
    }

    if (!window.confirm(`プロジェクト「${target.name}」を削除しますか？`)) {
      return;
    }

    await deleteProject(projectId);
  };

  const handleRestoreVersion = async (version: number) => {
    const message = hasUnsavedChanges
      ? `未保存の変更を破棄して v${version} の内容で復元しますか？復元後は新しい版として保存されます。`
      : `v${version} の内容で復元しますか？復元後は新しい版として保存されます。`;

    if (!window.confirm(message)) {
      return;
    }

    await restoreVersion(version);
    await loadVersionHistory();
    setActiveView("gantt");
  };

  const openSvgExportDialog = () => {
    const storedPeriod = loadStoredSvgExportPeriod(selectedProjectId);
    setSvgExportStartDate(storedPeriod?.startDate ?? projectStartDate);
    setSvgExportEndDate(storedPeriod?.endDate ?? projectEndDate);
    setSvgExportShowOwner(showOwnerInSidebar);
    setSvgExportShowStartDate(showStartDateInSidebar);
    setSvgExportShowEndDate(showEndDateInSidebar);
    setSvgExportShowProgress(showProgressInSidebar);
    setIsSvgExportDialogOpen(true);
  };

  const handleSvgExportStartDateChange = (value: string) => {
    setSvgExportStartDate(value);
    saveStoredSvgExportPeriod(selectedProjectId, value, svgExportEndDate);
  };

  const handleSvgExportEndDateChange = (value: string) => {
    setSvgExportEndDate(value);
    saveStoredSvgExportPeriod(selectedProjectId, svgExportStartDate, value);
  };

  const handleSvgExportReset = () => {
    setSvgExportStartDate(projectStartDate);
    setSvgExportEndDate(projectEndDate);
    saveStoredSvgExportPeriod(selectedProjectId, projectStartDate, projectEndDate);
  };

  const handleSvgExport = () => {
    if (!hasSvgExportRange) {
      window.alert("出力期間の開始日と終了日を入力してください。");
      return;
    }

    if (svgExportEndDate < svgExportStartDate) {
      window.alert("終了日は開始日以降の日付を指定してください。");
      return;
    }

    exportGanttAsSvg({
      projectName,
      projectVersion,
      timelineScale,
      tasks,
      dependencies,
      holidays,
      collapsedTaskIds,
      excludeNonWorkingDays,
      showBaseline,
      baselineDate,
      periodStartDate: svgExportStartDate,
      periodEndDate: svgExportEndDate,
      columns: {
        owner: svgExportShowOwner,
        startDate: svgExportShowStartDate,
        endDate: svgExportShowEndDate,
        progress: svgExportShowProgress,
      },
    });
    setIsSvgExportDialogOpen(false);
  };

  const exportVisibleTasks = useMemo(
    () => buildVisibleTasks(tasks, collapsedTaskIds),
    [collapsedTaskIds, tasks],
  );
  const exportMilestoneCount = useMemo(
    () => exportVisibleTasks.filter((task) => task.type === "milestone").length,
    [exportVisibleTasks],
  );

  return (
    <main className="h-screen overflow-hidden bg-slate-50 text-slate-900">
      <div className="mx-auto flex h-full w-full max-w-[1680px] gap-4 px-4 py-4 lg:px-6">
        <aside
          className={cn(
            "shrink-0 rounded-lg border border-slate-200 bg-white shadow-sm transition-all",
            isSidebarCollapsed ? "w-[72px]" : "w-[220px]",
          )}
        >
          <div className="border-b border-slate-200 px-3 py-3">
            <div
              className={cn(
                "flex items-center gap-2",
                isSidebarCollapsed ? "justify-center" : "justify-between",
              )}
            >
              <div
                className={cn(
                  "inline-flex items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 text-xs font-medium text-cyan-700",
                  isSidebarCollapsed ? "px-2 py-2" : "px-3 py-1",
                )}
              >
                <CalendarRange className="h-4 w-4" />
                {!isSidebarCollapsed ? <span>My ガントチャート</span> : null}
              </div>
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed((current) => !current)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700"
                title={isSidebarCollapsed ? "左ペインを開く" : "左ペインを閉じる"}
                aria-label={isSidebarCollapsed ? "左ペインを開く" : "左ペインを閉じる"}
              >
                {isSidebarCollapsed ? (
                  <ArrowRightToLine className="h-4 w-4" />
                ) : (
                  <ArrowLeftToLine className="h-4 w-4" />
                )}
              </button>
            </div>
            {!isSidebarCollapsed ? (
              <div className="mt-3 space-y-3">
                <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => handleSidebarSectionChange("project")}
                    className={cn(
                      "inline-flex h-8 items-center whitespace-nowrap rounded px-2 text-xs transition",
                      sidebarSection === "project"
                        ? "bg-white text-cyan-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-900",
                    )}
                  >
                    プロジェクト設定
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSidebarSectionChange("system")}
                    className={cn(
                      "inline-flex h-8 items-center whitespace-nowrap rounded px-2 text-xs transition",
                      sidebarSection === "system"
                        ? "bg-white text-cyan-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-900",
                    )}
                  >
                    システム設定
                  </button>
                </div>
                {sidebarSection === "project" ? (
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-slate-600">プロジェクト</span>
                    <select
                      value={selectedProjectId}
                      onChange={(event) => void handleProjectSwitch(Number(event.target.value))}
                      className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300"
                    >
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            ) : null}
          </div>

          <nav className="p-2">
            {visibleViews.map((view) => {
              const Icon = view.icon;
              return (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => setActiveView(view.id)}
                  className={cn(
                    "flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm transition",
                    isSidebarCollapsed ? "justify-center" : "gap-3",
                    activeView === view.id
                      ? "bg-cyan-50 font-medium text-cyan-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  )}
                  title={isSidebarCollapsed ? view.label : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {!isSidebarCollapsed ? <span>{view.label}</span> : null}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 overflow-hidden">
          {activeView === "gantt" ? (
            <div className="flex h-full flex-col">
              <header className="sticky top-0 z-40 mb-4 rounded-lg border border-slate-200 bg-slate-50/95 shadow-sm backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold text-slate-900">{projectName}</h2>
                      <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {`v${projectVersion}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-md border border-slate-200 bg-white p-1">
                      <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={isSaving || !hasUnsavedChanges}
                        title="保存"
                        aria-label="保存"
                        className={cn(
                          "inline-flex h-9 w-9 items-center justify-center rounded text-sm font-medium transition",
                          isSaving || !hasUnsavedChanges
                            ? "cursor-not-allowed text-slate-400"
                            : "text-slate-700 hover:bg-cyan-50 hover:text-cyan-700",
                        )}
                      >
                        <Save className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleDiscard}
                        disabled={!hasUnsavedChanges}
                        title="編集を破棄"
                        aria-label="編集を破棄"
                        className={cn(
                          "inline-flex h-9 w-9 items-center justify-center rounded text-sm font-medium transition",
                          hasUnsavedChanges
                            ? "text-slate-700 hover:bg-cyan-50 hover:text-cyan-700"
                            : "cursor-not-allowed text-slate-400",
                        )}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="inline-flex rounded-md border border-slate-200 bg-white p-1">
                      <button
                        type="button"
                        onClick={() => void handleReload()}
                        title="再読み込み"
                        aria-label="再読み込み"
                        className="inline-flex h-9 w-9 items-center justify-center rounded text-sm font-medium text-slate-700 transition hover:bg-cyan-50 hover:text-cyan-700"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="inline-flex rounded-md border border-slate-200 bg-white p-1">
                      <button
                        type="button"
                        onClick={openSvgExportDialog}
                        title="SVG出力"
                        aria-label="SVG出力"
                        className="inline-flex h-9 w-9 items-center justify-center rounded text-sm font-medium text-slate-700 transition hover:bg-cyan-50 hover:text-cyan-700"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="inline-flex rounded-md border border-slate-200 bg-white p-1">
                      {timelineScaleOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setTimelineScale(option.value)}
                          className={cn(
                            "inline-flex h-8 items-center rounded px-3 text-sm transition",
                            timelineScale === option.value
                              ? "bg-cyan-50 text-cyan-700"
                              : "text-slate-500 hover:text-slate-900",
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    <div className="inline-flex rounded-md border border-slate-200 bg-white p-1">
                      <button
                        type="button"
                        onClick={toggleSidebarOwnerVisibility}
                        title="担当者列の表示切替"
                        aria-label="担当者列の表示切替"
                        className={cn(
                          "inline-flex h-9 w-9 items-center justify-center rounded text-sm font-medium transition",
                          showOwnerInSidebar
                            ? "bg-cyan-50 text-cyan-700"
                            : "text-slate-700 hover:bg-cyan-50 hover:text-cyan-700",
                        )}
                      >
                        <UserRound className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={toggleSidebarStartDateVisibility}
                        title="開始日列の表示切替"
                        aria-label="開始日列の表示切替"
                        className={cn(
                          "inline-flex h-9 w-9 items-center justify-center rounded text-sm font-medium transition",
                          showStartDateInSidebar
                            ? "bg-cyan-50 text-cyan-700"
                            : "text-slate-700 hover:bg-cyan-50 hover:text-cyan-700",
                        )}
                      >
                        <CalendarDays className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={toggleSidebarEndDateVisibility}
                        title="終了日列の表示切替"
                        aria-label="終了日列の表示切替"
                        className={cn(
                          "inline-flex h-9 w-9 items-center justify-center rounded text-sm font-medium transition",
                          showEndDateInSidebar
                            ? "bg-cyan-50 text-cyan-700"
                            : "text-slate-700 hover:bg-cyan-50 hover:text-cyan-700",
                        )}
                      >
                        <CalendarRange className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={toggleSidebarProgressVisibility}
                        title="進捗率列の表示切替"
                        aria-label="進捗率列の表示切替"
                        className={cn(
                          "inline-flex h-9 w-9 items-center justify-center rounded text-sm font-medium transition",
                          showProgressInSidebar
                            ? "bg-cyan-50 text-cyan-700"
                            : "text-slate-700 hover:bg-cyan-50 hover:text-cyan-700",
                        )}
                      >
                        %
                      </button>
                    </div>

                    <div className="inline-flex rounded-md border border-slate-200 bg-white p-1">
                      <button
                        type="button"
                        onClick={() => addTask(selectedTask ? "sibling" : "tail", "milestone")}
                        title="マイルストーン追加"
                        aria-label="マイルストーン追加"
                        className="inline-flex h-9 w-9 items-center justify-center rounded text-sm font-medium text-slate-700 transition hover:bg-cyan-50 hover:text-cyan-700"
                      >
                        <Diamond className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="inline-flex rounded-md border border-slate-200 bg-white p-1">
                      <button
                        type="button"
                        onClick={() => addTask("child")}
                        disabled={!selectedTask || isSelectedMilestone}
                        title="子タスク追加"
                        aria-label="子タスク追加"
                        className={cn(
                          "inline-flex h-9 w-9 items-center justify-center rounded text-sm font-medium transition",
                          selectedTask && !isSelectedMilestone
                            ? "text-slate-700 hover:bg-cyan-50 hover:text-cyan-700"
                            : "cursor-not-allowed text-slate-400",
                        )}
                      >
                        <FolderPlus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => addTask("sibling")}
                        disabled={!selectedTask}
                        title="兄弟に追加"
                        aria-label="兄弟に追加"
                        className={cn(
                          "inline-flex h-9 w-9 items-center justify-center rounded text-sm font-medium transition",
                          selectedTask
                            ? "text-slate-700 hover:bg-cyan-50 hover:text-cyan-700"
                            : "cursor-not-allowed text-slate-400",
                        )}
                      >
                        <Rows3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => addTask("tail")}
                        title="末尾に追加"
                        aria-label="末尾に追加"
                        className="inline-flex h-9 w-9 items-center justify-center rounded text-sm font-medium text-slate-700 transition hover:bg-cyan-50 hover:text-cyan-700"
                      >
                        <FilePlus2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="inline-flex rounded-md border border-slate-200 bg-white p-1">
                      <button
                        type="button"
                        onClick={() => setInteractionMode("schedule")}
                        className={cn(
                          "inline-flex h-8 items-center gap-2 rounded px-3 text-sm transition",
                          interactionMode === "schedule"
                            ? "bg-cyan-50 text-cyan-700"
                            : "text-slate-500 hover:text-slate-900",
                        )}
                      >
                        <MoveHorizontal className="h-4 w-4" />
                        スケジュール
                      </button>
                      <button
                        type="button"
                        onClick={() => setInteractionMode("dependency")}
                        className={cn(
                          "inline-flex h-8 items-center gap-2 rounded px-3 text-sm transition",
                          interactionMode === "dependency"
                            ? "bg-cyan-50 text-cyan-700"
                            : "text-slate-500 hover:text-slate-900",
                        )}
                      >
                        <GitBranch className="h-4 w-4" />
                        関連線
                      </button>
                    </div>

                    <div className="inline-flex h-9 items-center gap-3 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={showBaseline}
                          onChange={(event) => setBaselineEnabled(event.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                        />
                        <span className="inline-flex items-center gap-2">
                          <span className="text-slate-500">基準日</span>
                        </span>
                      </label>
                      <input
                        type="date"
                        value={baselineDate}
                        disabled={!showBaseline}
                        onChange={(event) => setBaselineDate(event.target.value)}
                        className={cn(
                          "border-none bg-transparent text-sm outline-none",
                          showBaseline ? "text-slate-900" : "cursor-not-allowed text-slate-400",
                        )}
                      />
                    </div>

                    
                  </div>
                </div>

                {selectedTask ? (
                  <div className="px-4 py-3">
                    {isSelectedMilestone ? (
                      <div className="grid gap-3 lg:grid-cols-[minmax(280px,720px)_180px_88px]">
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-medium text-slate-600">名称</span>
                          <input
                            type="text"
                            value={selectedTask.name}
                            onChange={(event) =>
                              updateTaskDetails(selectedTask.id, {
                                name: event.target.value,
                                owner: selectedTask.owner,
                                progress: selectedTask.progress,
                                status: selectedTask.status,
                              })
                            }
                            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-medium text-slate-600">日付</span>
                          <input
                            type="date"
                            value={selectedTask.startDate}
                            onChange={(event) =>
                              updateTaskSchedule(
                                selectedTask.id,
                                event.target.value,
                                event.target.value,
                              )
                            }
                            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300"
                          />
                        </label>
                        <div className="flex items-end justify-end">
                          <button
                            type="button"
                            onClick={() => deleteTask(selectedTask.id)}
                            className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                          >
                            <Trash2 className="h-4 w-4" />
                            削除
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-3 lg:grid-cols-[minmax(260px,2fr)_160px_150px_150px_170px_120px_110px_auto]">
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-medium text-slate-600">名称</span>
                          <input
                            type="text"
                            value={selectedTask.name}
                            onChange={(event) =>
                              updateTaskDetails(selectedTask.id, {
                                name: event.target.value,
                                owner: selectedTask.owner,
                                progress: selectedTask.progress,
                                status: selectedTask.status,
                              })
                            }
                            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300"
                          />
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-medium text-slate-600">担当者</span>
                          <input
                            type="text"
                            list="member-candidates"
                            value={selectedTask.owner === "未設定" ? "" : selectedTask.owner}
                            placeholder="未設定"
                            onFocus={(event) => {
                              event.currentTarget.showPicker?.();
                            }}
                            onClick={(event) => {
                              event.currentTarget.showPicker?.();
                            }}
                            onBlur={(event) => {
                              if (event.target.value.trim() === "") {
                                updateTaskDetails(selectedTask.id, {
                                  name: selectedTask.name,
                                  owner: "未設定",
                                  progress: selectedTask.progress,
                                  status: selectedTask.status,
                                });
                              }
                            }}
                            onChange={(event) =>
                              updateTaskDetails(selectedTask.id, {
                                name: selectedTask.name,
                                owner: event.target.value,
                                progress: selectedTask.progress,
                                status: selectedTask.status,
                              })
                            }
                            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300"
                          />
                          <datalist id="member-candidates">
                            {memberNames.map((name) => (
                              <option key={name} value={name} />
                            ))}
                          </datalist>
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-medium text-slate-600">開始日</span>
                          <input
                            type="date"
                            value={selectedTask.startDate}
                            onChange={(event) =>
                              updateTaskSchedule(
                                selectedTask.id,
                                event.target.value,
                                selectedTask.endDate,
                              )
                            }
                            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300"
                          />
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-medium text-slate-600">終了日</span>
                          <input
                            type="date"
                            value={selectedTask.endDate}
                            onChange={(event) =>
                              updateTaskSchedule(
                                selectedTask.id,
                                selectedTask.startDate,
                                event.target.value,
                              )
                            }
                            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300"
                          />
                        </label>

                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-medium text-slate-600">親タスク</span>
                            <label className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                              <input
                                type="checkbox"
                                checked={showAllParentTaskOptions}
                                onChange={toggleAllParentTaskOptionsVisibility}
                                className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-300"
                              />
                              全て表示
                            </label>
                          </div>
                          <select
                            value={selectedTask.parentTaskId ?? ""}
                            onChange={(event) =>
                              setTaskParent(
                                selectedTask.id,
                                event.target.value === "" ? null : Number(event.target.value),
                              )
                            }
                            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300"
                          >
                            <option value="">なし</option>
                            {parentTaskCandidates.map((task) => (
                              <option key={task.id} value={task.id}>
                                {task.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-medium text-slate-600">進捗率 %</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={selectedTask.progress}
                            disabled={selectedTaskHasChildren}
                            onChange={(event) =>
                              updateTaskDetails(selectedTask.id, {
                                name: selectedTask.name,
                                owner: selectedTask.owner,
                                progress: Number(event.target.value),
                                status:
                                  Number(event.target.value) >= 100
                                    ? "done"
                                    : selectedTask.status === "done"
                                      ? "in_progress"
                                      : selectedTask.status,
                              })
                            }
                            className={cn(
                              "h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300",
                              selectedTaskHasChildren &&
                                "cursor-not-allowed bg-slate-100 text-slate-500",
                            )}
                          />
                        </label>

                        <label className="flex items-end gap-2 pb-px">
                          <input
                            type="checkbox"
                            checked={selectedTask.status === "done"}
                            disabled={selectedTaskHasChildren}
                            onChange={(event) =>
                              updateTaskDetails(selectedTask.id, {
                                name: selectedTask.name,
                                owner: selectedTask.owner,
                                progress: event.target.checked
                                  ? 100
                                  : selectedTask.progress === 100
                                    ? 99
                                    : selectedTask.progress,
                                status: event.target.checked ? "done" : "in_progress",
                              })
                            }
                            className="mb-2 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-300"
                          />
                          <span className="mb-1 text-sm text-slate-700">完了</span>
                        </label>

                        <div className="flex items-end justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => moveTaskUp(selectedTask.id)}
                            title="上へ移動"
                            aria-label="上へ移動"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveTaskDown(selectedTask.id)}
                            title="下へ移動"
                            aria-label="下へ移動"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTask(selectedTask.id)}
                            title="削除"
                            aria-label="削除"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </header>

              {interactionMode === "dependency" ? (
                <div className="mb-3 rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
                  {pendingDependencyFromTaskId === null
                    ? "関連線モードです。始点にしたいタスクをクリックし、次に終点のタスクをクリックすると関連線を追加できます。既存の関連線をクリックすると削除できます。"
                    : "関連元のタスクを選択中です。次に終点のタスクをクリックしてください。もう一度クリックするとキャンセルできます。"}
                </div>
              ) : null}

              {status === "error" && error ? (
                <div className="mb-3 flex items-center gap-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              <section className="min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <GanttBoard />
              </section>
            </div>
          ) : null}

          {activeView === "project" ? (
            <div className="flex h-full flex-col gap-4 overflow-auto">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">基本設定</h2>
                <div className="mt-4 grid gap-4">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-slate-600">プロジェクト名</span>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(event) => setProjectName(event.target.value)}
                      className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300"
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2 lg:max-w-[380px]">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-medium text-slate-600">開始日</span>
                      <input
                        type="date"
                        value={projectStartDate}
                        onChange={(event) => setProjectSchedule(event.target.value, projectEndDate)}
                        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-medium text-slate-600">終了日</span>
                      <input
                        type="date"
                        value={projectEndDate}
                        onChange={(event) => setProjectSchedule(projectStartDate, event.target.value)}
                        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300"
                      />
                    </label>
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          {activeView === "projectHoliday" ? (
            <div className="flex h-full flex-col gap-4 overflow-auto">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">プロジェクト休日</h2>
                <div className="mt-4 flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                  <CalendarDays className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-700">
                    土日祝日を進捗計算から除外する
                  </span>
                  <label className="ml-auto inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={excludeNonWorkingDays}
                      onChange={toggleNonWorkingDayExclusion}
                      className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-300"
                    />
                    有効
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">プロジェクト休日一覧</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      祝日の追加、編集、CSV / JSON アップロードができます。
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={holidayUploadRef}
                      type="file"
                      accept=".csv,.json"
                      className="hidden"
                      onChange={(event) => void handleHolidayUpload(event)}
                    />
                    <button
                      type="button"
                      onClick={() => holidayUploadRef.current?.click()}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                    >
                      <Upload className="h-4 w-4" />
                      アップロード
                    </button>
                    <button
                      type="button"
                      onClick={addHoliday}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                    >
                      <CalendarDays className="h-4 w-4" />
                      休日追加
                    </button>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
                  <div className="grid grid-cols-[160px_minmax(0,1fr)_88px] border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
                    <span>日付</span>
                    <span>名称</span>
                    <span />
                  </div>
                  <div className="divide-y divide-slate-200">
                    {projectHolidays.map((holiday) => (
                      <div
                        key={holiday.id}
                        className="grid grid-cols-[160px_minmax(0,1fr)_88px] items-center gap-3 px-3 py-2"
                      >
                        <input
                          type="date"
                          value={holiday.date}
                          onChange={(event) =>
                            updateHoliday(holiday.id, {
                              date: event.target.value,
                              name: holiday.name,
                            })
                          }
                          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300"
                        />
                        <input
                          type="text"
                          value={holiday.name}
                          onChange={(event) =>
                            updateHoliday(holiday.id, {
                              date: holiday.date,
                              name: event.target.value,
                            })
                          }
                          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300"
                        />
                        <button
                          type="button"
                          onClick={() => deleteHoliday(holiday.id)}
                          className="inline-flex h-9 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          {activeView === "versions" ? (
            <div className="flex h-full flex-col gap-4 overflow-auto">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">バージョン管理</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      保存済みの版を新しい最新版として復元できます。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadVersionHistory()}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                  >
                    <RefreshCw className="h-4 w-4" />
                    一覧更新
                  </button>
                </div>

                <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
                  <div className="grid grid-cols-[120px_180px_minmax(0,1fr)_96px] border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
                    <span>バージョン</span>
                    <span>保存日時</span>
                    <span>備考</span>
                    <span className="text-right">操作</span>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {versionHistory.map((item) => (
                      <div
                        key={item.version}
                        className="grid grid-cols-[120px_180px_minmax(0,1fr)_96px] items-center gap-3 px-3 py-2"
                      >
                        <span className="text-sm font-medium text-slate-800">{`v${item.version}`}</span>
                        <span className="text-sm text-slate-600">
                          {new Date(item.savedAt).toLocaleString("ja-JP", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="text-sm text-slate-600">
                          {item.note && item.note.trim().length > 0 ? item.note : "-"}
                        </span>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => void handleRestoreVersion(item.version)}
                            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                          >
                            復元
                          </button>
                        </div>
                      </div>
                    ))}
                    {versionHistory.length === 0 ? (
                      <div className="px-3 py-6 text-sm text-slate-500">保存済みの版はまだありません。</div>
                    ) : null}
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          {activeView === "projectAdmin" ? (
            <div className="flex h-full flex-col gap-4 overflow-auto">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">プロジェクト管理</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      プロジェクトの追加、削除、コピー元指定を管理できます。
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 rounded-md border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-medium text-slate-600">新しいプロジェクト名</span>
                      <input
                        type="text"
                        value={newProjectName}
                        onChange={(event) => setNewProjectName(event.target.value)}
                        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-medium text-slate-600">コピー元プロジェクト</span>
                      <select
                        value={sourceProjectId ?? ""}
                        onChange={(event) =>
                          setSourceProjectId(event.target.value ? Number(event.target.value) : null)
                        }
                        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300"
                      >
                        <option value="">コピーしない</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {[
                      { label: "基本設定", checked: copyBasicSettings, setter: setCopyBasicSettings },
                      { label: "タスク", checked: copyTasks, setter: setCopyTasks },
                      { label: "関連線", checked: copyDependencies, setter: setCopyDependencies },
                      { label: "プロジェクト休日", checked: copyHolidays, setter: setCopyHolidays },
                      { label: "メンバー設定", checked: copyMembers, setter: setCopyMembers },
                    ].map(({ label, checked, setter }) => (
                      <label
                        key={label}
                        className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => setter(event.target.checked)}
                          disabled={!sourceProjectId || (label === "関連線" && !copyTasks)}
                          className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-300"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void handleCreateProject()}
                      className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                    >
                      <FolderPlus className="h-4 w-4" />
                      プロジェクト追加
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">プロジェクト一覧</h3>
                <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
                  <div className="grid grid-cols-[80px_minmax(0,1fr)_120px_120px] border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
                    <span>ID</span>
                    <span>プロジェクト名</span>
                    <span>バージョン</span>
                    <span className="text-right">操作</span>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        className="grid grid-cols-[80px_minmax(0,1fr)_120px_120px] items-center gap-3 px-3 py-2"
                      >
                        <span className="text-sm text-slate-500">{project.id}</span>
                        <span className="text-sm font-medium text-slate-800">{project.name}</span>
                        <span className="text-sm text-slate-600">{`v${project.version}`}</span>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void handleProjectSwitch(project.id)}
                            className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                          >
                            切替
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteProject(project.id)}
                            disabled={projects.length <= 1}
                            className={cn(
                              "inline-flex h-9 items-center rounded-md border px-3 text-sm transition",
                              projects.length <= 1
                                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                                : "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100",
                            )}
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          {activeView === "systemHoliday" ? (
            <div className="flex h-full flex-col gap-4 overflow-auto">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">祝日設定</h2>
                <p className="mt-1 text-sm text-slate-500">
                  システム共通の祝日を設定します。すべてのプロジェクトで共通に使われます。
                </p>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">祝日一覧</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      祝日の追加、編集、CSV / JSON アップロードができます。
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={systemHolidayUploadRef}
                      type="file"
                      accept=".csv,.json"
                      className="hidden"
                      onChange={(event) => void handleSystemHolidayUpload(event)}
                    />
                    <button
                      type="button"
                      onClick={() => systemHolidayUploadRef.current?.click()}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                    >
                      <Upload className="h-4 w-4" />
                      アップロード
                    </button>
                    <button
                      type="button"
                      onClick={addSystemHoliday}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                    >
                      <CalendarDays className="h-4 w-4" />
                      祝日追加
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveSystemHolidayChanges()}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                    >
                      <Save className="h-4 w-4" />
                      保存
                    </button>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
                  <div className="grid grid-cols-[160px_minmax(0,1fr)_88px] border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
                    <span>日付</span>
                    <span>名称</span>
                    <span />
                  </div>
                  <div className="divide-y divide-slate-200">
                    {systemHolidays.map((holiday) => (
                      <div
                        key={holiday.id}
                        className="grid grid-cols-[160px_minmax(0,1fr)_88px] items-center gap-3 px-3 py-2"
                      >
                        <input
                          type="date"
                          value={holiday.date}
                          onChange={(event) =>
                            updateSystemHoliday(holiday.id, {
                              date: event.target.value,
                              name: holiday.name,
                            })
                          }
                          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300"
                        />
                        <input
                          type="text"
                          value={holiday.name}
                          onChange={(event) =>
                            updateSystemHoliday(holiday.id, {
                              date: holiday.date,
                              name: event.target.value,
                            })
                          }
                          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300"
                        />
                        <button
                          type="button"
                          onClick={() => deleteSystemHoliday(holiday.id)}
                          className="inline-flex h-9 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          {activeView === "members" ? (
            <div className="flex h-full flex-col gap-4 overflow-auto">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">メンバー設定</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      担当者の追加、編集、並び順変更ができます。タスク編集では候補から選べて、直接入力もできます。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addMember}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                  >
                    <UserRound className="h-4 w-4" />
                    メンバー追加
                  </button>
                </div>

                <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
                  <div className="grid grid-cols-[56px_minmax(0,1fr)_120px] border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
                    <span>No.</span>
                    <span>担当者名</span>
                    <span className="text-right">操作</span>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {members.map((member, index) => (
                      <div
                        key={member.id}
                        className="grid grid-cols-[56px_minmax(0,1fr)_120px] items-center gap-3 px-3 py-2"
                      >
                        <span className="text-sm text-slate-500">{index + 1}</span>
                        <input
                          type="text"
                          value={member.name}
                          onChange={(event) => updateMember(member.id, event.target.value)}
                          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300"
                        />
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => moveMemberUp(member.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveMemberDown(member.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMember(member.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </div>

      {isSvgExportDialogOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/30 px-4">
          <div className="w-full max-w-[640px] rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">SVG出力</h3>
                <p className="mt-1 text-sm text-slate-500">
                  出力期間とタスク一覧に含める列を選んで、現在のガントチャートを SVG として出力します。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSvgExportDialogOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-cyan-300 hover:text-cyan-700"
                aria-label="SVG出力ダイアログを閉じる"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-slate-600">開始日</span>
                  <input
                    type="date"
                    value={svgExportStartDate}
                    onChange={(event) => handleSvgExportStartDateChange(event.target.value)}
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-slate-600">終了日</span>
                  <input
                    type="date"
                    value={svgExportEndDate}
                    onChange={(event) => handleSvgExportEndDateChange(event.target.value)}
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300"
                  />
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSvgExportReset}
                  className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                >
                  リセット
                </button>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">タスク一覧の出力列</h4>
                    <p className="mt-1 text-xs text-slate-500">
                      名称、No.、工数は常に出力されます。必要な列だけ追加で含められます。
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>{`出力対象タスク: ${Math.max(exportVisibleTasks.length - exportMilestoneCount, 0)}件`}</p>
                    <p>{`マイルストーン: ${exportMilestoneCount}件`}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      label: "担当者",
                      checked: svgExportShowOwner,
                      onChange: setSvgExportShowOwner,
                    },
                    {
                      label: "開始日",
                      checked: svgExportShowStartDate,
                      onChange: setSvgExportShowStartDate,
                    },
                    {
                      label: "終了日",
                      checked: svgExportShowEndDate,
                      onChange: setSvgExportShowEndDate,
                    },
                    {
                      label: "進捗率",
                      checked: svgExportShowProgress,
                      onChange: setSvgExportShowProgress,
                    },
                  ].map((item) => (
                    <label
                      key={item.label}
                      className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(event) => item.onChange(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-300"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSvgExportDialogOpen(false)}
                className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSvgExport}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-4 text-sm font-medium text-cyan-700 transition hover:border-cyan-300 hover:bg-cyan-100"
              >
                <Printer className="h-4 w-4" />
                SVG出力
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
