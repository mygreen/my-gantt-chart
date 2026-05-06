import { useEffect, useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Check, Diamond, FilePlus2, FolderPlus, Rows3, Trash2 } from "lucide-react";
import { DependencyLayer } from "@/components/gantt/layers/DependencyLayer";
import { GridLayer } from "@/components/gantt/layers/GridLayer";
import { HeaderLayer } from "@/components/gantt/layers/HeaderLayer";
import { InazumaLayer } from "@/components/gantt/layers/InazumaLayer";
import { MilestoneLayer } from "@/components/gantt/layers/MilestoneLayer";
import { SidebarLayer } from "@/components/gantt/layers/SidebarLayer";
import { TaskLayer } from "@/components/gantt/layers/TaskLayer";
import { useGanttData } from "@/hooks/useGanttData";
import { useGanttStore } from "@/stores/useGanttStore";
import { cn } from "@/utils/cn";

type ContextMenuState = {
  taskId: number;
  x: number;
  y: number;
};

function buildSidebarColumns(
  showOwnerColumn: boolean,
  showStartDateColumn: boolean,
  showEndDateColumn: boolean,
  showProgressColumn: boolean,
) {
  const columns = ["32px", "minmax(0,2.2fr)"];
  if (showOwnerColumn) {
    columns.push("minmax(72px,0.9fr)");
  }
  if (showStartDateColumn) {
    columns.push("88px");
  }
  if (showEndDateColumn) {
    columns.push("88px");
  }
  if (showProgressColumn) {
    columns.push("64px");
  }
  columns.push("56px", "12px");
  return columns.join(" ");
}

export function GanttBoard() {
  const {
    tasks,
    visibleTasks,
    orderedTasks,
    milestoneTasks,
    dependencies,
    holidays,
    viewport,
    timelineScale,
    showBaseline,
    baselineDate,
    interactionMode,
    pendingDependencyFromTaskId,
    selectedTaskId,
    timelineCells,
    layouts,
    milestoneLayouts,
    status,
  } = useGanttData();

  const addTask = useGanttStore((state) => state.addTask);
  const deleteTask = useGanttStore((state) => state.deleteTask);
  const selectTask = useGanttStore((state) => state.selectTask);
  const showOwnerInSidebar = useGanttStore((state) => state.showOwnerInSidebar);
  const showStartDateInSidebar = useGanttStore((state) => state.showStartDateInSidebar);
  const showEndDateInSidebar = useGanttStore((state) => state.showEndDateInSidebar);
  const showProgressInSidebar = useGanttStore((state) => state.showProgressInSidebar);
  const toggleTaskDone = useGanttStore((state) => state.toggleTaskDone);
  const excludeNonWorkingDays = useGanttStore((state) => state.excludeNonWorkingDays);

  const filteredDependencies = useMemo(
    () =>
      dependencies.filter((dependency) => {
        const fromTask = tasks.find((task) => task.id === dependency.fromTaskId);
        const toTask = tasks.find((task) => task.id === dependency.toTaskId);
        return fromTask?.type !== "milestone" && toTask?.type !== "milestone";
      }),
    [dependencies, tasks],
  );

  const [scrollTop, setScrollTop] = useState(0);
  const [rawScrollTop, setRawScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
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
  const rowOffset = milestoneTasks.length > 0 ? 1 : 0;
  const rowCount = visibleTasks.length + rowOffset;
  const boardHeight = Math.max(rowCount * viewport.rowHeight, viewport.rowHeight * 8);
  const inazumaTopOffset = milestoneTasks.length > 0 ? viewport.rowHeight : 0;
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const contextTask = tasks.find((task) => task.id === contextMenu?.taskId) ?? null;
  const milestoneMenuTask =
    selectedTask?.type === "milestone" ? selectedTask : (milestoneTasks[0] ?? null);
  const sidebarColumns = buildSidebarColumns(
    showOwnerInSidebar,
    showStartDateInSidebar,
    showEndDateInSidebar,
    showProgressInSidebar,
  );
  const visibleBoardWidth = Math.max(viewportWidth - viewport.sidebarWidth, 0);

  const handleTaskContextMenu = (taskId: number, event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    selectTask(taskId);
    setContextMenu({
      taskId,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleMilestoneAreaContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!milestoneMenuTask) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    selectTask(milestoneMenuTask.id);
    setContextMenu({
      taskId: milestoneMenuTask.id,
      x: event.clientX,
      y: event.clientY,
    });
  };

  return (
    <div
      className="relative h-full overflow-auto"
      onScroll={(event) => {
        const nextScrollTop = event.currentTarget.scrollTop;
        setScrollTop(Math.max(0, nextScrollTop - viewport.headerHeight));
        setRawScrollTop(nextScrollTop);
        setScrollLeft(event.currentTarget.scrollLeft);
        setViewportWidth(event.currentTarget.clientWidth);
        setContextMenu(null);
      }}
      ref={(node) => {
        if (!node) {
          return;
        }

        if (viewportWidth !== node.clientWidth) {
          setViewportWidth(node.clientWidth);
        }
      }}
    >
      <div className="sticky top-0 z-50 flex min-w-max bg-white">
        <div
          className="sticky left-0 z-[60] shrink-0 border-r border-slate-200 bg-slate-50"
          style={{ width: viewport.sidebarWidth }}
        >
          <div
            className="grid h-[60px] items-center gap-2 px-3 text-[11px] font-semibold text-slate-600"
            style={{ gridTemplateColumns: sidebarColumns }}
          >
            <span className="text-right">No.</span>
            <span>名称</span>
            {showOwnerInSidebar ? <span>担当者</span> : null}
            {showStartDateInSidebar ? <span>開始日</span> : null}
            {showEndDateInSidebar ? <span>終了日</span> : null}
            {showProgressInSidebar ? <span className="text-right">進捗率</span> : null}
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
          className="relative sticky left-0 z-30 shrink-0 bg-white"
          style={{ width: viewport.sidebarWidth }}
        >
          {milestoneTasks.length > 0 ? (
            <div
              className="sticky z-40 grid items-center gap-2 border-b border-slate-200 bg-amber-50/95 pl-2 pr-3 backdrop-blur"
              style={{
                top: viewport.headerHeight,
                height: viewport.rowHeight,
                gridTemplateColumns: sidebarColumns,
              }}
              onContextMenu={handleMilestoneAreaContextMenu}
            >
              <p className="text-right text-xs text-slate-400" />
              <p className="truncate text-xs font-medium text-amber-800">マイルストーン</p>
              {showOwnerInSidebar ? <p className="text-xs text-slate-400" /> : null}
              {showStartDateInSidebar ? <p className="text-xs text-slate-400" /> : null}
              {showEndDateInSidebar ? <p className="text-xs text-slate-400" /> : null}
              {showProgressInSidebar ? <p className="text-xs text-slate-400" /> : null}
              <p className="text-right text-xs text-slate-400" />
              <span className="inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </div>
          ) : null}

          <SidebarLayer
            tasks={visibleTasks}
            taskNumbers={taskNumbers}
            rowHeight={viewport.rowHeight}
            status={status}
            selectedTaskId={selectedTaskId}
            showOwnerColumn={showOwnerInSidebar}
            showStartDateColumn={showStartDateInSidebar}
            showEndDateColumn={showEndDateInSidebar}
            showProgressColumn={showProgressInSidebar}
            onTaskContextMenu={handleTaskContextMenu}
          />
        </div>

        <div
          className="relative z-0 shrink-0 bg-white"
          style={{ width: boardWidth, height: boardHeight }}
        >
          {milestoneTasks.length > 0 ? (
            <div
              className="sticky z-30 overflow-hidden border-b border-slate-200 bg-white/95 backdrop-blur"
              style={{
                top: viewport.headerHeight,
                height: viewport.rowHeight,
              }}
              onContextMenu={handleMilestoneAreaContextMenu}
            >
              {timelineCells.map((cell, cellIndex) => (
                <div
                  key={`milestone-cell-${cell.key}`}
                  className={cn(
                    "absolute inset-y-0 border-r border-slate-200",
                    timelineScale === "day" && cell.isNonWorking ? "bg-rose-50" : "bg-white/95",
                  )}
                  style={{
                    left: cellIndex * viewport.dayWidth,
                    width: viewport.dayWidth,
                  }}
                />
              ))}
              <MilestoneLayer
                tasks={milestoneTasks}
                layouts={milestoneLayouts}
                selectedTaskId={selectedTaskId}
                interactionMode={interactionMode}
                pendingDependencyFromTaskId={pendingDependencyFromTaskId}
                timelineScale={timelineScale}
                dayWidth={viewport.dayWidth}
                onTaskContextMenu={handleTaskContextMenu}
              />
            </div>
          ) : null}

          <GridLayer
            timelineCells={timelineCells}
            cellWidth={viewport.dayWidth}
            rowHeight={viewport.rowHeight}
            rowCount={rowCount}
            scale={timelineScale}
          />
          <DependencyLayer
            dependencies={filteredDependencies}
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
          {showBaseline && baselineDate ? (
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
              topOffset={inazumaTopOffset}
              viewportTop={rawScrollTop}
              viewportLeft={scrollLeft}
              viewportWidth={visibleBoardWidth}
            />
          ) : null}
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
          {contextTask.type === "milestone" ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => {
                selectTask(contextTask.id);
                addTask("sibling", "milestone");
                setContextMenu(null);
              }}
            >
              <Diamond className="h-4 w-4" />
              マイルストーン追加
            </button>
          ) : (
            <>
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
                  selectTask(contextTask.id);
                  addTask("sibling");
                  setContextMenu(null);
                }}
              >
                <Rows3 className="h-4 w-4" />
                兄弟に追加
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
            </>
          )}
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

      {status === "ready" && visibleTasks.length === 0 && milestoneTasks.length === 0 ? (
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
