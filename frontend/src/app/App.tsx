import { useEffect } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CalendarRange,
  CalendarX2,
  FilePlus2,
  FolderPlus,
  GitBranch,
  MoveHorizontal,
  RefreshCw,
  Trash2,
  UserRound,
} from "lucide-react";
import { GanttBoard } from "@/components/gantt/GanttBoard";
import type { TimelineScale } from "@/models/gantt";
import { useGanttStore } from "@/stores/useGanttStore";
import { cn } from "@/utils/cn";

const timelineScaleOptions: Array<{ value: TimelineScale; label: string }> = [
  { value: "month", label: "月" },
  { value: "week", label: "週" },
  { value: "day", label: "日" },
];

export function App() {
  const tasks = useGanttStore((state) => state.tasks);
  const loadTasks = useGanttStore((state) => state.loadTasks);
  const addTask = useGanttStore((state) => state.addTask);
  const deleteTask = useGanttStore((state) => state.deleteTask);
  const moveTaskUp = useGanttStore((state) => state.moveTaskUp);
  const moveTaskDown = useGanttStore((state) => state.moveTaskDown);
  const status = useGanttStore((state) => state.status);
  const error = useGanttStore((state) => state.error);
  const interactionMode = useGanttStore((state) => state.interactionMode);
  const pendingDependencyFromTaskId = useGanttStore((state) => state.pendingDependencyFromTaskId);
  const selectedTaskId = useGanttStore((state) => state.selectedTaskId);
  const showOwnerInSidebar = useGanttStore((state) => state.showOwnerInSidebar);
  const excludeNonWorkingDays = useGanttStore((state) => state.excludeNonWorkingDays);
  const timelineScale = useGanttStore((state) => state.timelineScale);
  const baselineDate = useGanttStore((state) => state.baselineDate);
  const setInteractionMode = useGanttStore((state) => state.setInteractionMode);
  const toggleSidebarOwnerVisibility = useGanttStore((state) => state.toggleSidebarOwnerVisibility);
  const toggleNonWorkingDayExclusion = useGanttStore(
    (state) => state.toggleNonWorkingDayExclusion,
  );
  const setTimelineScale = useGanttStore((state) => state.setTimelineScale);
  const setBaselineDate = useGanttStore((state) => state.setBaselineDate);
  const updateTaskDetails = useGanttStore((state) => state.updateTaskDetails);
  const setTaskParent = useGanttStore((state) => state.setTaskParent);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const selectedTaskHasChildren = selectedTask
    ? tasks.some((task) => task.parentTaskId === selectedTask.id)
    : false;

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-4 py-4 lg:px-6">
        <header className="sticky top-0 z-40 mb-4 rounded-lg border border-slate-200 bg-slate-50/95 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-700">
                <CalendarRange className="h-4 w-4" />
                ガントチャート Web アプリ
              </div>
              <h1 className="mt-2 text-xl font-semibold text-slate-900">
                チーム進行ガントチャート
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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

              <label className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
                <CalendarDays className="h-4 w-4 text-slate-500" />
                <span className="text-slate-500">基準日</span>
                <input
                  type="date"
                  value={baselineDate}
                  onChange={(event) => setBaselineDate(event.target.value)}
                  className="border-none bg-transparent text-sm text-slate-900 outline-none"
                />
              </label>

              <button
                type="button"
                onClick={() => addTask("child")}
                disabled={!selectedTask}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition",
                  selectedTask
                    ? "border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:text-cyan-700"
                    : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400",
                )}
              >
                <FolderPlus className="h-4 w-4" />
                子タスク追加
              </button>
              <button
                type="button"
                onClick={() => addTask("tail")}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
              >
                <FilePlus2 className="h-4 w-4" />
                末尾に追加
              </button>
              <button
                type="button"
                onClick={() => void loadTasks()}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
              >
                <RefreshCw className="h-4 w-4" />
                再読み込み
              </button>
              <button
                type="button"
                onClick={toggleSidebarOwnerVisibility}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition",
                  showOwnerInSidebar
                    ? "border-cyan-200 bg-cyan-50 text-cyan-700"
                    : "border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:text-cyan-700",
                )}
              >
                <UserRound className="h-4 w-4" />
                担当者列
              </button>
              <button
                type="button"
                onClick={toggleNonWorkingDayExclusion}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition",
                  excludeNonWorkingDays
                    ? "border-cyan-200 bg-cyan-50 text-cyan-700"
                    : "border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:text-cyan-700",
                )}
              >
                <CalendarX2 className="h-4 w-4" />
                土日祝を除外
              </button>
            </div>
          </div>

          {selectedTask ? (
            <div className="grid gap-2 px-4 py-3 lg:grid-cols-[minmax(0,2fr)_160px_160px_120px_120px_auto]">
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
                  value={selectedTask.owner}
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
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-slate-600">親タスク</span>
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
                  {tasks
                    .filter((task) => task.id !== selectedTask.id)
                    .map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.name}
                      </option>
                    ))}
                </select>
              </label>
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
                    selectedTaskHasChildren && "cursor-not-allowed bg-slate-100 text-slate-500",
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
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                >
                  <ArrowUp className="h-4 w-4" />
                  上へ
                </button>
                <button
                  type="button"
                  onClick={() => moveTaskDown(selectedTask.id)}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                >
                  <ArrowDown className="h-4 w-4" />
                  下へ
                </button>
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
          ) : null}
        </header>

        {interactionMode === "dependency" ? (
          <div className="mb-3 rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
            {pendingDependencyFromTaskId === null
              ? "関連線モードです。始点にしたいタスクをクリックし、次に接続先のタスクをクリックすると関連線を追加できます。既存の関連線をクリックすると削除できます。"
              : "関連元のタスクを選択中です。次に接続先のタスクをクリックしてください。もう一度クリックするとキャンセルできます。"}
          </div>
        ) : null}

        {status === "error" && error ? (
          <div className="mb-3 flex items-center gap-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <section className="flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <GanttBoard />
        </section>
      </div>
    </main>
  );
}
