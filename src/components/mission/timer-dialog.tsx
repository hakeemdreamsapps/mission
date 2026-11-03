import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatClock, formatWhen } from "@/lib/mission/format";
import { useMission } from "@/lib/mission/store";
import {
  BrassButton,
  fieldClass,
  GhostButton,
  IconButton,
  Kicker,
  useEscape,
  useScrollLock,
} from "@/components/mission/ui";

const PRESETS = [5, 10, 15, 25, 45];

export function EngageDialog({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const item = useMission((state) => state.items.find((entry) => entry.id === itemId));
  const task = useMission((state) =>
    item ? state.tasks.find((entry) => entry.id === item.taskId) : undefined,
  );
  const startRun = useMission((state) => state.startRun);
  const [preset, setPreset] = useState<number | null>(10);
  const [custom, setCustom] = useState("");

  useEscape(true, onClose);
  useScrollLock(true);

  if (!item || item.done) return null;

  const parsed = custom.trim() === "" ? preset : Number(custom);
  const valid = parsed != null && Number.isInteger(parsed) && parsed >= 1 && parsed <= 180;

  return (
    <div className="fixed inset-0 z-40 flex justify-center bg-bg/80" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="engage-title"
        className="flex h-dvh w-full max-w-md flex-col bg-surface"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="h-1 shrink-0 bg-brass" />
        <div className="flex shrink-0 items-center justify-between border-b border-fg/10 px-4 py-2">
          <Kicker>Mission</Kicker>
          <IconButton type="button" aria-label="Close" onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-5">
          <h2 id="engage-title" className="text-2xl font-semibold tracking-tight">
            {item.title}
          </h2>
          {task && <p className="text-sm text-muted">{task.title}</p>}
          <p className="text-muted">The clock starts now. Check this item off before it hits zero.</p>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((minutes) => (
              <GhostButton
                key={minutes}
                type="button"
                className={cn(preset === minutes && custom.trim() === "" && "border-brass bg-brass text-bg")}
                onClick={() => {
                  setPreset(minutes);
                  setCustom("");
                }}
              >
                {minutes} min
              </GhostButton>
            ))}
          </div>
          <div>
            <label htmlFor="custom-minutes" className="mb-2 block text-sm text-muted">
              Custom minutes
            </label>
            <input
              id="custom-minutes"
              inputMode="numeric"
              className={fieldClass}
              placeholder="1–180"
              value={custom}
              onChange={(event) => setCustom(event.target.value.replace(/[^\d]/g, "").slice(0, 3))}
            />
          </div>
          <BrassButton
            type="button"
            disabled={!valid || parsed == null}
            onClick={() => {
              if (parsed == null) return;
              startRun(item.id, parsed * 60_000);
              onClose();
            }}
          >
            Start mission
          </BrassButton>
        </div>
      </div>
    </div>
  );
}

export function MissionOverlay({ now }: { now: number }) {
  const run = useMission((state) => state.run);
  const item = useMission((state) =>
    state.run ? state.items.find((entry) => entry.id === state.run?.itemId) : undefined,
  );
  const task = useMission((state) =>
    item ? state.tasks.find((entry) => entry.id === item.taskId) : undefined,
  );
  const clearRun = useMission((state) => state.clearRun);
  const abortRun = useMission((state) => state.abortRun);
  const dismissRun = useMission((state) => state.dismissRun);
  const markDone = useMission((state) => state.markDone);
  const streak = useMission((state) => state.streak);
  const bestStreak = useMission((state) => state.bestStreak);

  const visible =
    run != null && (run.status === "running" || run.status === "cleared" || run.status === "failed");

  useScrollLock(visible);

  if (!run || !visible) return null;

  const title = item?.title ?? "This item was removed";
  const remaining = Math.max(0, run.endsAt - now);
  const urgent = run.status === "running" && remaining <= 60_000;
  const progress = run.durationMs === 0 ? 0 : Math.min(1, remaining / run.durationMs);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-bg"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mission-live-title"
    >
      <div className="h-1 bg-brass" />
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
        <Kicker>
          {run.status === "running" ? "Live" : run.status === "cleared" ? "Cleared" : "Time's up"}
        </Kicker>
        <h2 id="mission-live-title" className="mt-3 max-w-md text-3xl font-semibold tracking-tight">
          {title}
        </h2>
        {task && <p className="mt-2 text-sm text-muted">{task.title}</p>}
        <p className="sr-only" role="status">
          {run.status === "failed" ? "Time is up." : run.status === "cleared" ? "Item cleared." : ""}
        </p>

        {run.status === "running" && (
          <>
            <div className="relative mt-8 grid size-64 place-items-center">
              <svg
                viewBox="0 0 100 100"
                className={cn("size-64", urgent ? "text-signal" : "text-brass")}
                aria-hidden="true"
              >
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity="0.2"
                  strokeWidth="4"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - progress)}
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <p className={cn("font-mono text-6xl tabular-nums", urgent && "mission-urgent text-signal")}>
                  {formatClock(remaining)}
                </p>
              </div>
            </div>
            <p className="mt-2 font-mono text-xs tracking-widest text-muted uppercase">Remaining</p>
            {task?.deadline != null && (
              <p className="mt-4 text-sm text-muted">List due {formatWhen(task.deadline, now)}</p>
            )}
            <div className="mt-8 grid w-full max-w-sm gap-2">
              <BrassButton type="button" onClick={() => clearRun()} disabled={!item}>
                Clear item
              </BrassButton>
              <GhostButton type="button" onClick={() => abortRun()}>
                Abort
              </GhostButton>
            </div>
          </>
        )}

        {run.status === "cleared" && (
          <div className="mt-8 w-full max-w-sm">
            <p className="font-mono text-6xl text-brass tabular-nums">{streak}</p>
            <p className="mt-2 font-mono text-xs tracking-widest text-muted uppercase">
              Streak{bestStreak > streak ? ` · best ${bestStreak}` : ""}
            </p>
            <BrassButton type="button" className="mt-8 w-full" onClick={() => dismissRun()}>
              Back to list
            </BrassButton>
          </div>
        )}

        {run.status === "failed" && (
          <div className="mt-8 w-full max-w-sm">
            <p className="font-mono text-6xl text-signal tabular-nums">00:00</p>
            <p className="mt-4 text-muted">The window closed. Streak reset.</p>
            <div className="mt-8 grid gap-2">
              {item && !item.done && (
                <BrassButton
                  type="button"
                  onClick={() => {
                    markDone(item.id);
                    dismissRun();
                  }}
                >
                  Mark cleared anyway
                </BrassButton>
              )}
              <GhostButton type="button" onClick={() => dismissRun()}>
                Back to list
              </GhostButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
