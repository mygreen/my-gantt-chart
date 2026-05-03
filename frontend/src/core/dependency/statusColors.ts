import type { TaskStatus } from "@/models/gantt";

export const statusColorMap: Record<TaskStatus, string> = {
  todo: "bg-slate-600",
  in_progress: "bg-cyan-500",
  done: "bg-emerald-500",
  blocked: "bg-rose-500",
};

export const statusBorderMap: Record<TaskStatus, string> = {
  todo: "border-slate-400/30",
  in_progress: "border-cyan-300/50",
  done: "border-slate-300",
  blocked: "border-rose-300/50",
};
