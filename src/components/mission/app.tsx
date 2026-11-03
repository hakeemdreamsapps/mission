import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bell, Check, ChevronLeft, ChevronRight, Flag, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatWhen } from "@/lib/mission/format";
import { notifyTask, playAlarm, playClear, playFail, playWand, unlockAudio } from "@/lib/mission/sound";
import { KEEP_MS, useMission } from "@/lib/mission/store";
import type { CheckItem, RunStatus, Task } from "@/lib/mission/types";
import { CompletionDate } from "@/components/mission/task-dialog";
import { EngageDialog, MissionOverlay } from "@/components/mission/timer-dialog";
import {
  BrassButton,
  fieldClass,
  GhostButton,
  IconButton,
  Kicker,
  QuietButton,
  useEscape,
  useScrollLock,
} from "@/components/mission/ui";

type Filter = "open" | "late" | "all";

export function MissionApp() {
  return <Board />;
}

function Board() {
  const tasks = useMission((state) => state.tasks);
  const items = useMission((state) => state.items);
  const run = useMission((state) => state.run);
  const streak = useMission((state) => state.streak);
  const clears = useMission((state) => state.clears);
  const fails = useMission((state) => state.fails);
  const addTask = useMission((state) => state.addTask);

  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState<Filter>("open");
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [engageId, setEngageId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  const runStatus = run?.status;
  const previousStatus = useRef<RunStatus | undefined>(runStatus);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    void useMission.persist.rehydrate();
  }, []);

  useEffect(() => {
    const tick = () => {
      const due = useMission.getState().sweepAlarms(Date.now());
      if (due.length > 0) {
        playAlarm();
        useMission.getState().showBanner(due.map((task) => task.id));
        for (const task of due) {
          notifyTask(task.title, "Alarm. This list is due.", task.id);
        }
      }
      const live = useMission.getState().run;
      if (live?.status === "running" && Date.now() >= live.endsAt) {
        useMission.getState().failRun();
        playFail();
      }
      useMission.getState().sweepExpired(Date.now());
      setNow(Date.now());
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const celebration = useMission((state) => state.celebration);
  const celebrated = useRef<string | null>(null);

  useEffect(() => {
    if (previousStatus.current === "running" && runStatus === "cleared") {
      if (!useMission.getState().celebration) playClear();
    }
    previousStatus.current = runStatus;
  }, [runStatus]);

  useEffect(() => {
    if (celebration && celebration !== celebrated.current) {
      playWand();
      celebrated.current = celebration;
    }
    if (!celebration) celebrated.current = null;
  }, [celebration]);

  useEffect(() => {
    if (openId && !tasks.some((task) => task.id === openId)) setOpenId(null);
  }, [openId, tasks]);

  useEffect(() => {
    if (!flashId) return;
    const id = window.setTimeout(() => setFlashId(null), 1600);
    return () => window.clearTimeout(id);
  }, [flashId]);

  const openTask = tasks.find((task) => task.id === openId) ?? null;
  const visible = sortTasks(
    tasks.filter((task) => {
      const stats = progress(items, task.id);
      if (filter === "all") return true;
      if (filter === "late") return isLate(task, stats, now);
      return !stats.cleared;
    }),
    items,
    now,
  );
  const finished = sortTasks(
    tasks.filter((task) => progress(items, task.id).cleared),
    items,
    now,
  );
  const openCount = tasks.filter((task) => !progress(items, task.id).cleared).length;
  const lateCount = tasks.filter((task) => isLate(task, progress(items, task.id), now)).length;
  const live =
    run != null && (run.status === "running" || run.status === "cleared" || run.status === "failed");

  const remember = (id: string | null) => {
    if (!id) return;
    setFlashId(id);
    requestAnimationFrame(() => {
      document.getElementById(`item-${id}`)?.scrollIntoView({ block: "nearest" });
    });
  };

  return (
    <div className="min-h-dvh overflow-x-hidden bg-bg">
      <div className="h-1 bg-brass" />
      <main className="mx-auto flex w-full max-w-lg min-w-0 flex-col gap-5 px-4 pt-6 pb-24">
        {openTask ? (
          <Checklist
            task={openTask}
            now={now}
            onBack={() => setOpenId(null)}
            onMission={(id) => setEngageId(id)}
          />
        ) : (
          <>
            <header>
              <Kicker>Mission</Kicker>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Field board</h1>
              <p className="mt-2 font-mono text-xs text-muted tabular-nums">
                {openCount} open
                {lateCount > 0 ? ` \u00b7 ${lateCount} late` : ""}
                {streak > 0 || clears > 0 || fails > 0 ? ` \u00b7 streak ${streak}` : ""}
              </p>
            </header>

            {composing ? (
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const name = draft.trim();
                  if (!name) return;
                  const id = addTask(name);
                  setDraft("");
                  setComposing(false);
                  if (id) setOpenId(id);
                  remember(id);
                }}
              >
                <input
                  aria-label="Task name"
                  className={fieldClass}
                  placeholder="Task name, like Groceries"
                  value={draft}
                  autoFocus
                  maxLength={140}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <BrassButton type="submit">Add</BrassButton>
                <IconButton
                  type="button"
                  aria-label="Cancel"
                  onClick={() => {
                    setComposing(false);
                    setDraft("");
                  }}
                >
                  <X className="size-5" />
                </IconButton>
              </form>
            ) : (
              <BrassButton
                type="button"
                onClick={() => {
                  setComposing(true);
                  setDraft("");
                }}
              >
                New task
              </BrassButton>
            )}

            {tasks.length > 0 && (
              <div className="grid grid-cols-3 border border-fg/15" role="group" aria-label="Show">
                {(
                  [
                    ["open", "Open"],
                    ["late", "Late"],
                    ["all", "All"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={filter === key}
                    className={cn(
                      "min-h-11 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass",
                      filter === key ? "bg-fg text-bg" : "text-muted",
                    )}
                    onClick={() => setFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <AlarmBanner now={now} onOpen={(id) => setOpenId(id)} />

            <section aria-label="Tasks">
              {visible.length > 0 && (
                <ul>
                  {visible.map((task) => {
                    const stats = progress(items, task.id);
                    const late = isLate(task, stats, now);
                    return (
                      <li
                        key={task.id}
                        id={`item-${task.id}`}
                        className={cn(
                          "border-b border-fg/10",
                          flashId === task.id && "border-l-2 border-l-brass",
                        )}
                      >
                        <button
                          type="button"
                          className="flex min-h-14 w-full items-center gap-3 py-3 text-left"
                          onClick={() => setOpenId(task.id)}
                        >
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "block truncate text-base",
                                stats.cleared && "text-muted line-through",
                              )}
                            >
                              {task.title}
                            </span>
                            <TaskMeta task={task} stats={stats} now={now} late={late} />
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-muted" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {visible.length === 0 && tasks.length === 0 && <EmptyBoard />}

              {visible.length === 0 && tasks.length > 0 && filter !== "open" && (
                <p className="py-6 text-muted">
                  {filter === "late" ? "Nothing is late." : "Every list is cleared."}
                </p>
              )}

              {filter === "open" && visible.length === 0 && finished.length === 0 && tasks.length > 0 && (
                <p className="py-6 text-muted">Every list is cleared.</p>
              )}

              {filter === "open" && finished.length > 0 && (
                <div className="mt-6">
                  <Kicker>Completed</Kicker>
                  <ul className="mt-2">
                    {finished.map((task) => (
                      <li key={task.id} className="border-b border-fg/10">
                        <button
                          type="button"
                          className="flex min-h-14 w-full items-center gap-3 py-3 text-left"
                          onClick={() => setOpenId(task.id)}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-base text-muted line-through">
                              {task.title}
                            </span>
                            <span className="mt-1 block font-mono text-xs text-brass">
                              COMPLETED
                              {task.completedAt != null ? ` \u00b7 ${keepLabel(task.completedAt, now)}` : ""}
                            </span>
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-muted" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {live && !celebration && <MissionOverlay now={now} />}
      {celebration && <CompletedBurst taskId={celebration} />}
      {!live && engageId && <EngageDialog itemId={engageId} onClose={() => setEngageId(null)} />}
    </div>
  );
}

function Checklist({
  task,
  now,
  onBack,
  onMission,
}: {
  task: Task;
  now: number;
  onBack: () => void;
  onMission: (itemId: string) => void;
}) {
  const allItems = useMission((state) => state.items);
  const items = allItems.filter((item) => item.taskId === task.id);
  const addItem = useMission((state) => state.addItem);
  const toggleItem = useMission((state) => state.toggleItem);
  const updateTask = useMission((state) => state.updateTask);
  const deleteTask = useMission((state) => state.deleteTask);
  const [draft, setDraft] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(task.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const ordered = [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.createdAt - b.createdAt;
  });
  const stats = progress(items, task.id);
  const late = isLate(task, stats, now);
  const picked = items.find((item) => item.id === pickedId) ?? null;

  return (
    <>
      <header>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-1 text-sm text-muted"
          onClick={onBack}
        >
          <ChevronLeft className="size-4" />
          Board
        </button>
        {renaming ? (
          <form
            className="mt-2 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              updateTask(task.id, { title: renameDraft });
              setRenaming(false);
            }}
          >
            <input
              aria-label="Task name"
              className={fieldClass}
              value={renameDraft}
              autoFocus
              maxLength={140}
              onChange={(event) => setRenameDraft(event.target.value)}
            />
            <BrassButton type="submit">Save</BrassButton>
          </form>
        ) : (
          <div className="mt-2 flex items-start gap-1">
            <h1 className="min-w-0 flex-1 truncate text-3xl font-semibold tracking-tight">
              {task.title}
            </h1>
            <IconButton
              type="button"
              aria-label="Rename task"
              onClick={() => {
                setRenameDraft(task.title);
                setRenaming(true);
                setConfirmDelete(false);
              }}
            >
              <Pencil className="size-5" />
            </IconButton>
            <IconButton
              type="button"
              aria-label="Delete task"
              className="text-signal"
              onClick={() => setConfirmDelete((value) => !value)}
            >
              <Trash2 className="size-5" />
            </IconButton>
          </div>
        )}
        <p className="mt-2 font-mono text-xs text-muted tabular-nums">
          {stats.total === 0
            ? "No items yet"
            : stats.cleared
              ? `COMPLETED${task.completedAt != null ? ` \u00b7 ${keepLabel(task.completedAt, now)}` : ""}`
              : `${stats.left} left`}
          {task.deadline != null ? ` \u00b7 ${late ? "Late" : "Due"} ${formatWhen(task.deadline, now)}` : ""}
        </p>
      </header>

      {confirmDelete && (
        <div className="border border-signal/50 p-3">
          <p className="text-sm">Delete \u201c{task.title}\u201d and its checklist?</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 items-center bg-signal px-4 font-semibold text-bg"
              onClick={() => {
                deleteTask(task.id);
                onBack();
              }}
            >
              Delete task
            </button>
            <QuietButton type="button" onClick={() => setConfirmDelete(false)}>
              Keep
            </QuietButton>
          </div>
        </div>
      )}

      <CompletionDate task={task} now={now} />

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const name = draft.trim();
          if (!name) return;
          addItem(task.id, name);
          setDraft("");
        }}
      >
        <input
          aria-label="Checklist item"
          className={fieldClass}
          placeholder="Add an item"
          value={draft}
          maxLength={140}
          onChange={(event) => setDraft(event.target.value)}
        />
        <BrassButton type="submit">Add</BrassButton>
      </form>

      <section aria-label="Checklist">
        {ordered.length === 0 ? (
          <p className="py-2 text-muted">Add each line, then tap one to time it as a Mission.</p>
        ) : (
          <ul>
            {ordered.map((item) => (
              <li key={item.id} className="border-b border-fg/10">
                <div className="flex items-stretch">
                  <button
                    type="button"
                    className="grid w-11 shrink-0 place-items-center"
                    aria-pressed={item.done}
                    aria-label={item.done ? `Reopen ${item.title}` : `Check off ${item.title}`}
                    onClick={() => toggleItem(item.id)}
                  >
                    <span
                      className={cn(
                        "grid size-5 place-items-center border",
                        item.done ? "border-brass bg-brass text-bg" : "border-fg/30",
                      )}
                    >
                      {item.done && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="flex min-h-14 min-w-0 flex-1 items-center py-3 pr-2 text-left"
                    onClick={() => setPickedId(item.id)}
                  >
                    <span className={cn("truncate text-base", item.done && "text-muted line-through")}>
                      {item.title}
                    </span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {picked && (
        <ItemSheet
          item={picked}
          onClose={() => setPickedId(null)}
          onMission={() => {
            setPickedId(null);
            onMission(picked.id);
          }}
        />
      )}
    </>
  );
}

function ItemSheet({
  item,
  onClose,
  onMission,
}: {
  item: CheckItem;
  onClose: () => void;
  onMission: () => void;
}) {
  const deleteItem = useMission((state) => state.deleteItem);
  useEscape(true, onClose);
  useScrollLock(true);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-bg/80" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-sheet-title"
        className="w-full max-w-md bg-surface"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="h-1 bg-brass" />
        <div className="flex items-center justify-between px-4 py-2">
          <Kicker>Checklist item</Kicker>
          <IconButton type="button" aria-label="Close" onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </div>
        <div className="flex flex-col gap-3 px-4 pt-2 pb-6">
          <h2 id="item-sheet-title" className="text-2xl font-semibold tracking-tight">
            {item.title}
          </h2>
          {!item.done && (
            <BrassButton type="button" onClick={onMission}>
              Mission
            </BrassButton>
          )}
          <GhostButton
            type="button"
            className="text-signal"
            onClick={() => {
              deleteItem(item.id);
              onClose();
            }}
          >
            Delete item
          </GhostButton>
        </div>
      </div>
    </div>
  );
}

function AlarmBanner({ now, onOpen }: { now: number; onOpen: (id: string) => void }) {
  const banner = useMission((state) => state.banner);
  const tasks = useMission((state) => state.tasks);
  const dismissBanner = useMission((state) => state.dismissBanner);
  const shown = (banner?.taskIds ?? [])
    .map((id) => tasks.find((task) => task.id === id))
    .filter((task): task is Task => task != null);

  if (shown.length === 0) return null;

  return (
    <section role="status" className="border border-brass bg-surface" aria-label="Alarms">
      <div className="flex items-center justify-between px-3">
        <Kicker>Alarm</Kicker>
        <QuietButton type="button" onClick={() => dismissBanner()}>
          Dismiss
        </QuietButton>
      </div>
      <ul>
        {shown.map((task) => (
          <li key={task.id} className="border-t border-fg/10">
            <button
              type="button"
              className="min-h-11 w-full truncate px-3 text-left"
              onClick={() => onOpen(task.id)}
            >
              {task.title}
              {task.deadline != null && (
                <span className="mt-0.5 block truncate font-mono text-xs text-muted">
                  Due {formatWhen(task.deadline, now)}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TaskMeta({
  task,
  stats,
  now,
  late,
}: {
  task: Task;
  stats: { total: number; left: number; cleared: boolean };
  now: number;
  late: boolean;
}) {
  const bits: { key: string; node: ReactNode }[] = [];
  bits.push({
    key: "count",
    node: (
      <span className="text-muted">
        {stats.total === 0 ? "Empty" : stats.cleared ? "COMPLETED" : `${stats.left} left`}
      </span>
    ),
  });
  if (task.deadline != null) {
    bits.push({
      key: "due",
      node: (
        <span className={cn("inline-flex items-center gap-1", late ? "text-signal" : "text-muted")}>
          <Flag className="size-3.5" />
          {late ? "Late" : "Due"} \u00b7 {formatWhen(task.deadline, now)}
        </span>
      ),
    });
  }
  if (task.alarmAt != null) {
    bits.push({
      key: "alarm",
      node: (
        <span className="inline-flex items-center gap-1 text-muted">
          <Bell className="size-3.5" />
          {task.alarmFired ? "Rang" : formatWhen(task.alarmAt, now)}
        </span>
      ),
    });
  }
  return (
    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">
      {bits.map((bit) => (
        <span key={bit.key}>{bit.node}</span>
      ))}
    </span>
  );
}

function CompletedBurst({ taskId }: { taskId: string }) {
  const task = useMission((state) => state.tasks.find((entry) => entry.id === taskId));
  const dismissCelebration = useMission((state) => state.dismissCelebration);
  const pieces = useMemo(() => makeConfetti(), []);

  useEscape(true, dismissCelebration);
  useScrollLock(true);

  useEffect(() => {
    const id = window.setTimeout(dismissCelebration, 6400);
    return () => window.clearTimeout(id);
  }, [dismissCelebration]);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-bg/95"
      role="dialog"
      aria-modal="true"
      aria-labelledby="completed-title"
      onClick={dismissCelebration}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {pieces.map((piece) => (
          <span
            key={piece.id}
            className="confetti-piece"
            style={{
              left: piece.left,
              width: piece.width,
              height: piece.height,
              background: piece.color,
              borderRadius: piece.radius,
              animationDuration: piece.duration,
              animationDelay: piece.delay,
              ["--drift" as string]: piece.drift,
              ["--spin" as string]: piece.spin,
            }}
          />
        ))}
      </div>
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p id="completed-title" className="font-mono text-3xl font-semibold tracking-[0.28em] text-brass">
          COMPLETED
        </p>
        <h2 className="mt-4 max-w-md text-3xl font-semibold tracking-tight">{task?.title ?? "List"}</h2>
        <p className="mt-3 max-w-xs text-muted">This list stays for 5 days, unless you delete it.</p>
        <BrassButton
          type="button"
          className="mt-8"
          onClick={(event) => {
            event.stopPropagation();
            dismissCelebration();
          }}
        >
          Continue
        </BrassButton>
      </div>
    </div>
  );
}

function makeConfetti() {
  const colors = ["#e2a23a", "#f0714f", "#efe8d6", "#9a9484"];
  return Array.from({ length: 36 }, (_, id) => ({
    id,
    left: `${(id * 37) % 100}%`,
    delay: `${(id % 8) * 0.07}s`,
    duration: `${2.5 + (id % 5) * 0.28}s`,
    drift: `${((id % 7) - 3) * 28}px`,
    spin: `${id % 2 === 0 ? 460 : -420}deg`,
    color: colors[id % colors.length] ?? "#e2a23a",
    width: id % 3 === 0 ? 9 : 6,
    height: id % 3 === 0 ? 16 : 10,
    radius: id % 4 === 0 ? "99px" : "0px",
  }));
}

function keepLabel(completedAt: number, now: number): string {
  const left = completedAt + KEEP_MS - now;
  const days = Math.max(1, Math.ceil(left / (24 * 60 * 60 * 1000)));
  return days === 1 ? "Kept 1 day" : `Kept ${days} days`;
}

function EmptyBoard() {
  return (
    <div className="py-6">
      <h2 className="text-xl font-semibold">Nothing filed yet.</h2>
      <p className="mt-2 text-muted">Name a task, then fill its checklist.</p>
      <ol className="mt-4 divide-y divide-fg/10">
        <Guide n="01" title="Name it" body="A task is the list. Groceries, not each grocery." />
        <Guide n="02" title="Check it" body="Open the task and add each item. Check them off as you go." />
        <Guide n="03" title="Mission" body="Tap an item to time that one line. Put a completion date on the task if it needs one." />
      </ol>
    </div>
  );
}

function Guide({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="flex gap-4 py-4">
      <span className="w-8 shrink-0 font-mono text-xs text-brass">{n}</span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="mt-1 block text-sm text-muted">{body}</span>
      </span>
    </li>
  );
}

function progress(items: CheckItem[], taskId: string) {
  const mine = items.filter((item) => item.taskId === taskId);
  const left = mine.filter((item) => !item.done).length;
  return {
    total: mine.length,
    left,
    cleared: mine.length > 0 && left === 0,
  };
}

function isLate(task: Task, stats: { cleared: boolean }, now: number): boolean {
  return !stats.cleared && task.deadline != null && task.deadline < now;
}

function sortTasks(list: Task[], items: CheckItem[], now: number): Task[] {
  return [...list].sort((a, b) => {
    const aStats = progress(items, a.id);
    const bStats = progress(items, b.id);
    if (aStats.cleared !== bStats.cleared) return aStats.cleared ? 1 : -1;
    const aLate = isLate(a, aStats, now);
    const bLate = isLate(b, bStats, now);
    if (aLate !== bLate) return aLate ? -1 : 1;
    if (!aStats.cleared && a.deadline != null && b.deadline != null) return a.deadline - b.deadline;
    if (!aStats.cleared && a.deadline != null && b.deadline == null) return -1;
    if (!aStats.cleared && a.deadline == null && b.deadline != null) return 1;
    return a.createdAt - b.createdAt;
  });
}
