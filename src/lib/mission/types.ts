export type Task = {
  id: string;
  title: string;
  deadline: number | null;
  alarmAt: number | null;
  alarmFired: boolean;
  completedAt: number | null;
  createdAt: number;
};

export type CheckItem = {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  createdAt: number;
};

export type RunStatus = "running" | "cleared" | "failed" | "aborted";

export type MissionRun = {
  itemId: string;
  startedAt: number;
  endsAt: number;
  durationMs: number;
  status: RunStatus;
};

export type Banner = {
  taskIds: string[];
};

export type TaskPatch = Partial<Pick<Task, "title" | "deadline" | "alarmAt">>;
