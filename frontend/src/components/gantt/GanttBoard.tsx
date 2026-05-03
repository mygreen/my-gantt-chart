import { useEffect, useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Check, FilePlus2, FolderPlus, Trash2 } from "lucide-react";
import { DependencyLayer } from "@/components/gantt/layers/DependencyLayer";
import { GridLayer } from "@/components/gantt/layers/GridLayer";
import { HeaderLayer } from "@/components/gantt/layers/HeaderLayer";
import { InazumaLayer } from "@/components/gantt/layers/InazumaLayer";
import { SidebarLayer } from "@/components/gantt/layers/SidebarLayer";
import { TaskLayer } from "@/components/gantt/layers/TaskLayer";
import { useGanttData } from "@/hooks/useGanttData";
import { useGanttStore } from "@/stores/useGanttStore";

type ContextMenuState = {
  taskId: number;
  x: number;
  y: number;
};

export function GanttBoard() {
  const {
    tasks,
    visibleTasks,
    orderedTasks,
    dependencies,
    holidays,
    viewport,
    timelineScale,
    baselineDate,
    interactionMode,
    pendingDependencyFromTaskId,
    selectedTaskId,
    timelineCells,
    layouts,
    status,
  } = useGanttData();

  const addTask = useGanttStore((state) => state.addTask);
  const deleteTask = useGanttStore((state) => state.deleteTask);
  const selectTask = useGanttStore((state) => state.selectTask);
  const showOwnerInSidebar = useGanttStore((state) => state.showOwnerInSidebar);
  const toggleTaskDone = useGanttStore((state) => state.toggleTaskDone);
  const excludeNonWorkingDays = useGanttStore((state) => state.excludeNonWorkingDays);

  const [scrollTop, setScrollTop] = useState(0);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const closeMenu = () => setContextMenu(null);
    window.addEventListener("click", closeMenu);
    window.addEventListener("resize", closeMenu);

    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("resize", closeMenu);
    };
  }, [contextMenu]);

  const taskNumbers = useMemo(
    () => new Map(orderedTasks.map((task, index) => [task.id, index + 1])),
    [orderedTasks],
  );
  const layoutMap = useMemo(
    () => new Map(layouts.map((layout) => [layout.taskId, layout])),
    [layouts],
  );
  const boardWidth = Math.max(timelineCells.length * viewport.dayWidth, viewport.dayWidth);
  const boardHeight = Math.max(visibleTasks.length * viewport.rowHeight, viewport.rowHeight * 8);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const contextTask = tasks.find((task) => task.id === contextMenu?.taskId) ?? null;
  const sidebarColumns = showOwnerInSidebar
    ? "32px minmax(0,2.6fr) minmax(56px,0.75fr) 56px 12px"
    : "32px minmax(0,1fr) 56px 12px";

  const handleTaskContextMenu = (taskId: number, event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    selectTask(taskId);
    setContextMenu({
      taskId,
      x: event.clientX,
      y: event.clientY,
    });
  };

  return (
    <div
      className="relative h-full overflow-auto"
      onScroll={(event) => {
        setScrollTop(Math.max(0, event.currentTarget.scrollTop - viewport.headerHeight));
        setContextMenu(null);
      }}
    >
      <div className="sticky top-0 z-20 flex min-w-max bg-white">
        <div
          className="sticky left-0 z-30 shrink-0 border-r border-slate-200 bg-slate-50"
          style={{ width: viewport.sidebarWidth }}
        >
          <div
            className="grid h-[60px] items-center gap-2 px-3 text-[11px] font-semibold text-slate-600"
            style={{ gridTemplateColumns: sidebarColumns }}
          >
            <span className="text-right">No.</span>
            <span>名称</span>
            {showOwnerInSidebar ? <span>担当者</span> : null}
            <span className="text-right">工数</span>
            <span />
          </div>
        </div>
        <div className="shrink-0" style={{ width: boardWidth }}>
          <HeaderLayer
            timelineCells={timelineCells}
            cellWidth={viewport.dayWidth}
            scale={timelineScale}
          />
        </div>
      </div>

      <div className="flex min-w-max">
        <div
          className="sticky left-0 z-10 shrink-0 bg-white"
          style={{ width: viewport.sidebarWidth }}
        >
          <SidebarLayer
            tasks={visibleTasks}
            taskNumbers={taskNumbers}
            rowHeight={viewport.rowHeight}
            status={status}
            selectedTaskId={selectedTaskId}
            showOwnerColumn={showOwnerInSidebar}
            onTaskContextMenu={handleTaskContextMenu}
          />
        </div>

        <div className="relative shrink-0 bg-white" style={{ width: boardWidth, height: boardHeight }}>
          <GridLayer
            timelineCells={timelineCells}
            tasks={visibleTasks}
            cellWidth={viewport.dayWidth}
            rowHeight={viewport.rowHeight}
            scale={timelineScale}
          />
          <DependencyLayer
            dependencies={dependencies}
            layoutMap={layoutMap}
            width={boardWidth}
            height={boardHeight}
            interactionMode={interactionMode}
          />
          <TaskLayer
            tasks={visibleTasks}
            layouts={layouts}
            scrollTop={scrollTop}
            dayWidth={viewport.dayWidth}
            timelineScale={timelineScale}
            interactionMode={interactionMode}
            pendingDependencyFromTaskId={pendingDependencyFromTaskId}
            selectedTaskId={selectedTaskId}
            onTaskContextMenu={handleTaskContextMenu}
          />
          <InazumaLayer
            tasks={visibleTasks}
            layouts={layouts}
            timelineCells={timelineCells}
            cellWidth={viewport.dayWidth}
            baselineDate={baselineDate}
            holidays={holidays}
            excludeNonWorkingDays={excludeNonWorkingDays}
            width={boardWidth}
            height={boardHeight}
          />
        </div>
      </div>

      {contextMenu && contextTask ? (
        <div
          className="fixed z-50 min-w-[180px] rounded-md border border-slate-200 bg-white p-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => {
              selectTask(contextTask.id);
              setContextMenu(null);
            }}
          >
            <Check className="h-4 w-4" />
            編集対象にする
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => {
              selectTask(contextTask.id);
              addTask("child");
              setContextMenu(null);
            }}
          >
            <FolderPlus className="h-4 w-4" />
            子タスク追加
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => {
              addTask("tail");
              setContextMenu(null);
            }}
          >
            <FilePlus2 className="h-4 w-4" />
            末尾に追加
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => {
              toggleTaskDone(contextTask.id);
              setContextMenu(null);
            }}
          >
            <Check className="h-4 w-4" />
            {contextTask.status === "done" ? "未完了に戻す" : "完了にする"}
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
            onClick={() => {
              deleteTask(contextTask.id);
              setContextMenu(null);
            }}
          >
            <Trash2 className="h-4 w-4" />
            削除
          </button>
        </div>
      ) : null}

      {status === "ready" && visibleTasks.length === 0 ? (
        <div className="pointer-events-none absolute inset-x-0 top-[96px] flex justify-center">
          <div className="rounded-md border border-slate-200 bg-white/95 px-4 py-2 text-sm text-slate-500 shadow-sm">
            表示できるタスクがありません。
          </div>
        </div>
      ) : null}

      {selectedTask && timelineScale !== "day" ? (
        <div className="pointer-events-none absolute bottom-4 right-4 rounded-md border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-500 shadow-sm">
          週表示・月表示ではドラッグとリサイズは無効です。
        </div>
      ) : null}
    </div>
  );
}
