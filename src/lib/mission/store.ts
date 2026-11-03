import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Banner, CheckItem, MissionRun, Task, TaskPatch } from "@/lib/mission/types";

type MissionState = {
  tasks: Task[];
  items: CheckItem[];
  run: MissionRun | null;
  clears: number;
  fails: number;
  streak: number;
  bestStreak: number;
  banner: Banner | null;
  celebration: string | null;
  addTask: (title: string) => string | null;
  updateTask: (id: string, patch: TaskPatch) => void;
  deleteTask: (id: string) => void;
  addItem: (taskId: string, title: string) => string | null;
  toggleItem: (id: string) => void;
  deleteItem: (id: string) => void;
  markDone: (id: string) => void;
  sweepAlarms: (now: number) => Task[];
  showBanner: (ids: string[]) => void;
  dismissBanner: (id?: string) => void;
  startRun: (itemId: string, durationMs: number) => void;
  clearRun: () => void;
  failRun: () => void;
  abortRun: () => void;
  dismissRun: () => void;
  dismissCelebration: () => void;
  sweepExpired: (now: number) => void;
};

type Persisted = {
  tasks: Task[];
  items: CheckItem[];
  run: MissionRun | null;
  clears: number;
  fails: number;
  streak: number;
  bestStreak: number;
};

const memoryStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

function dropBanner(banner: Banner | null, id: string): Banner | null {
  if (!banner) return null;
  const taskIds = banner.taskIds.filter((item) => item !== id);
  return taskIds.length ? { taskIds } : null;
}

function uid(): string {
  return crypto.randomUUID();
}

export const KEEP_MS = 5 * 24 * 60 * 60 * 1000;

function listIsClear(items: CheckItem[], taskId: string): boolean {
  const mine = items.filter((item) => item.taskId === taskId);
  return mine.length > 0 && mine.every((item) => item.done);
}

function applyCompletion(tasks: Task[], items: CheckItem[], taskId: string, now: number) {
  let justFinished = false;
  const next = tasks.map((task) => {
    if (task.id !== taskId) return task;
    const clear = listIsClear(items, taskId);
    if (clear && task.completedAt == null) {
      justFinished = true;
      return { ...task, completedAt: now };
    }
    if (!clear && task.completedAt != null) return { ...task, completedAt: null };
    return task;
  });
  return { tasks: next, justFinished };
}

function nextCelebration(
  current: string | null,
  taskId: string,
  justFinished: boolean,
  stillClear: boolean,
): string | null {
  if (justFinished) return taskId;
  if (current === taskId && !stillClear) return null;
  return current;
}

function asTask(raw: Record<string, unknown>): Task | null {
  if (typeof raw.id !== "string" || typeof raw.title !== "string") return null;
  return {
    id: raw.id,
    title: raw.title.slice(0, 140),
    deadline: typeof raw.deadline === "number" ? raw.deadline : null,
    alarmAt: typeof raw.alarmAt === "number" ? raw.alarmAt : null,
    alarmFired: raw.alarmFired === true,
    completedAt: typeof raw.completedAt === "number" ? raw.completedAt : null,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
  };
}

export const useMission = create<MissionState>()(
  persist(
    (set, get) => ({
      tasks: [],
      items: [],
      run: null,
      clears: 0,
      fails: 0,
      streak: 0,
      bestStreak: 0,
      banner: null,
      celebration: null,

      addTask: (title) => {
        const trimmed = title.trim().slice(0, 140);
        if (!trimmed) return null;
        const task: Task = {
          id: uid(),
          title: trimmed,
          deadline: null,
          alarmAt: null,
          alarmFired: false,
          completedAt: null,
          createdAt: Date.now(),
        };
        set({ tasks: [...get().tasks, task] });
        return task.id;
      },

      updateTask: (id, patch) => {
        set({
          tasks: get().tasks.map((task) => {
            if (task.id !== id) return task;
            const next: Task = { ...task, ...patch };
            if (
              patch.alarmAt !== undefined &&
              (patch.alarmAt == null || patch.alarmAt > Date.now())
            ) {
              next.alarmFired = false;
            }
            if (patch.title != null) {
              const sliced = patch.title.slice(0, 140);
              if (!sliced.trim()) return task;
              next.title = sliced;
            }
            return next;
          }),
        });
      },

      deleteTask: (id) => {
        const removed = new Set(
          get()
            .items.filter((item) => item.taskId === id)
            .map((item) => item.id),
        );
        const run = get().run;
        set({
          tasks: get().tasks.filter((task) => task.id !== id),
          items: get().items.filter((item) => item.taskId !== id),
          run: run && removed.has(run.itemId) ? null : run,
          banner: dropBanner(get().banner, id),
          celebration: get().celebration === id ? null : get().celebration,
        });
      },

      addItem: (taskId, title) => {
        const trimmed = title.trim().slice(0, 140);
        if (!trimmed) return null;
        if (!get().tasks.some((task) => task.id === taskId)) return null;
        const item: CheckItem = {
          id: uid(),
          taskId,
          title: trimmed,
          done: false,
          createdAt: Date.now(),
        };
        const items = [...get().items, item];
        const applied = applyCompletion(get().tasks, items, taskId, Date.now());
        set({
          items,
          tasks: applied.tasks,
          celebration: nextCelebration(
            get().celebration,
            taskId,
            applied.justFinished,
            listIsClear(items, taskId),
          ),
        });
        return item.id;
      },

      toggleItem: (id) => {
        const item = get().items.find((entry) => entry.id === id);
        if (!item) return;
        if (!item.done) {
          const run = get().run;
          if (run?.status === "running" && run.itemId === id) {
            get().clearRun();
            return;
          }
          const items = get().items.map((entry) =>
            entry.id === id ? { ...entry, done: true } : entry,
          );
          const applied = applyCompletion(get().tasks, items, item.taskId, Date.now());
          set({
            items,
            tasks: applied.tasks,
            celebration: nextCelebration(
              get().celebration,
              item.taskId,
              applied.justFinished,
              true,
            ),
          });
          return;
        }
        const items = get().items.map((entry) =>
          entry.id === id ? { ...entry, done: false } : entry,
        );
        const applied = applyCompletion(get().tasks, items, item.taskId, Date.now());
        set({
          items,
          tasks: applied.tasks,
          celebration: nextCelebration(get().celebration, item.taskId, false, false),
        });
      },

      deleteItem: (id) => {
        const item = get().items.find((entry) => entry.id === id);
        if (!item) return;
        const items = get().items.filter((entry) => entry.id !== id);
        const applied = applyCompletion(get().tasks, items, item.taskId, Date.now());
        const run = get().run;
        set({
          items,
          tasks: applied.tasks,
          run: run?.itemId === id ? null : run,
          celebration: nextCelebration(
            get().celebration,
            item.taskId,
            applied.justFinished,
            listIsClear(items, item.taskId),
          ),
        });
      },

      markDone: (id) => {
        const item = get().items.find((entry) => entry.id === id);
        if (!item || item.done) return;
        const items = get().items.map((entry) =>
          entry.id === id ? { ...entry, done: true } : entry,
        );
        const applied = applyCompletion(get().tasks, items, item.taskId, Date.now());
        set({
          items,
          tasks: applied.tasks,
          celebration: nextCelebration(
            get().celebration,
            item.taskId,
            applied.justFinished,
            true,
          ),
        });
      },

      sweepAlarms: (now) => {
        const items = get().items;
        const due = get().tasks.filter((task) => {
          if (task.alarmFired || task.alarmAt == null || task.alarmAt > now) return false;
          const mine = items.filter((item) => item.taskId === task.id);
          return !(mine.length > 0 && mine.every((item) => item.done));
        });
        if (due.length === 0) return [];
        const ids = new Set(due.map((task) => task.id));
        set({
          tasks: get().tasks.map((task) =>
            ids.has(task.id) ? { ...task, alarmFired: true } : task,
          ),
        });
        return due;
      },

      showBanner: (ids) => {
        const merged = [...(get().banner?.taskIds ?? [])];
        for (const id of ids) {
          if (!merged.includes(id)) merged.push(id);
        }
        if (merged.length === 0) return;
        set({ banner: { taskIds: merged } });
      },

      dismissBanner: (id) => {
        if (!id) {
          set({ banner: null });
          return;
        }
        set({ banner: dropBanner(get().banner, id) });
      },

      startRun: (itemId, durationMs) => {
        const item = get().items.find((entry) => entry.id === itemId);
        if (!item || item.done) return;
        const now = Date.now();
        const safe = Math.min(Math.max(durationMs, 1000), 180 * 60_000);
        set({
          run: {
            itemId,
            startedAt: now,
            endsAt: now + safe,
            durationMs: safe,
            status: "running",
          },
        });
      },

      clearRun: () => {
        const run = get().run;
        if (!run || run.status !== "running") return;
        const streak = get().streak + 1;
        const items = get().items.map((item) =>
          item.id === run.itemId ? { ...item, done: true } : item,
        );
        const taskId = get().items.find((item) => item.id === run.itemId)?.taskId;
        const applied = taskId
          ? applyCompletion(get().tasks, items, taskId, Date.now())
          : { tasks: get().tasks, justFinished: false };
        set({
          run: { ...run, status: "cleared" },
          streak,
          bestStreak: Math.max(get().bestStreak, streak),
          clears: get().clears + 1,
          items,
          tasks: applied.tasks,
          celebration: taskId
            ? nextCelebration(get().celebration, taskId, applied.justFinished, true)
            : get().celebration,
        });
      },

      failRun: () => {
        const run = get().run;
        if (!run || run.status !== "running") return;
        set({
          run: { ...run, status: "failed" },
          streak: 0,
          fails: get().fails + 1,
        });
      },

      abortRun: () => {
        const run = get().run;
        if (!run || run.status !== "running") return;
        set({ run: { ...run, status: "aborted" } });
      },

      dismissRun: () => set({ run: null }),

      dismissCelebration: () => {
        const run = get().run;
        set({
          celebration: null,
          run: run?.status === "cleared" ? null : run,
        });
      },

      sweepExpired: (now) => {
        const cutoff = now - KEEP_MS;
        const doomed = get().tasks.filter(
          (task) => task.completedAt != null && task.completedAt <= cutoff,
        );
        if (doomed.length === 0) return;
        const ids = new Set(doomed.map((task) => task.id));
        let banner = get().banner;
        for (const id of ids) banner = dropBanner(banner, id);
        const run = get().run;
        const runningItem = run ? get().items.find((item) => item.id === run.itemId) : undefined;
        const celebration = get().celebration;
        set({
          tasks: get().tasks.filter((task) => !ids.has(task.id)),
          items: get().items.filter((item) => !ids.has(item.taskId)),
          run: runningItem && ids.has(runningItem.taskId) ? null : run,
          banner,
          celebration: celebration && ids.has(celebration) ? null : celebration,
        });
      },
    }),
    {
      name: "mission-board-v1",
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? memoryStorage : window.localStorage,
      ),
      partialize: (state) => ({
        tasks: state.tasks,
        items: state.items,
        run: state.run,
        clears: state.clears,
        fails: state.fails,
        streak: state.streak,
        bestStreak: state.bestStreak,
      }),
      migrate: (persisted, version) => {
        const data = (persisted ?? {}) as Partial<Persisted> & {
          tasks?: Array<Record<string, unknown>>;
        };
        if (version >= 1 && Array.isArray(data.items)) return data as Persisted;
        return {
          tasks: (data.tasks ?? [])
            .map((task) => asTask(task))
            .filter((task): task is Task => task != null),
          items: [],
          run: null,
          clears: typeof data.clears === "number" ? data.clears : 0,
          fails: typeof data.fails === "number" ? data.fails : 0,
          streak: typeof data.streak === "number" ? data.streak : 0,
          bestStreak: typeof data.bestStreak === "number" ? data.bestStreak : 0,
        } satisfies Persisted;
      },
    },
  ),
);
