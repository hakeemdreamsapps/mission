import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  fromLocalInput,
  HOUR,
  MINUTE,
  quickDeadlines,
  toLocalInput,
} from "@/lib/mission/format";
import { requestAlerts } from "@/lib/mission/sound";
import { useMission } from "@/lib/mission/store";
import type { Task } from "@/lib/mission/types";
import { fieldClass, GhostButton, QuietButton } from "@/components/mission/ui";

type AlarmChoice = "none" | "at" | "15" | "60" | "custom";

function alarmChoice(task: Task): AlarmChoice {
  if (task.alarmAt == null) return "none";
  if (task.deadline != null && task.alarmAt === task.deadline) return "at";
  if (task.deadline != null && task.alarmAt === task.deadline - 15 * MINUTE) return "15";
  if (task.deadline != null && task.alarmAt === task.deadline - HOUR) return "60";
  return "custom";
}

function relativeAlarm(choice: AlarmChoice, deadline: number | null): number | null {
  if (choice === "none" || choice === "custom") return null;
  if (deadline == null) return null;
  if (choice === "at") return deadline;
  if (choice === "15") return deadline - 15 * MINUTE;
  return deadline - HOUR;
}

export function CompletionDate({ task, now }: { task: Task; now: number }) {
  const updateTask = useMission((state) => state.updateTask);
  const [hint, setHint] = useState("");
  const [customAlarm, setCustomAlarm] = useState(false);
  const [alerts, setAlerts] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (typeof Notification === "undefined") setAlerts("unsupported");
    else setAlerts(Notification.permission);
  }, []);

  const choice = alarmChoice(task);
  const deadlines = quickDeadlines(now);

  const applyDeadline = (deadline: number | null) => {
    const preset = alarmChoice(task);
    let alarmAt = task.alarmAt;
    if (preset === "at" || preset === "15" || preset === "60") {
      alarmAt = relativeAlarm(preset, deadline);
      if (alarmAt != null && alarmAt <= Date.now()) {
        alarmAt = null;
        setHint("That reminder would already have passed, so it was cleared.");
      } else {
        setHint("");
      }
    }
    updateTask(task.id, { deadline, alarmAt });
  };

  const applyAlarm = (next: AlarmChoice) => {
    if (next === "custom") return;
    if (next === "none") {
      setHint("");
      setCustomAlarm(false);
      updateTask(task.id, { alarmAt: null });
      return;
    }
    setCustomAlarm(false);
    const alarmAt = relativeAlarm(next, task.deadline);
    if (alarmAt == null) return;
    if (alarmAt <= Date.now()) {
      setHint("That reminder is already in the past.");
      return;
    }
    setHint("");
    updateTask(task.id, { alarmAt });
  };

  return (
    <section className="border border-fg/15 p-3" aria-label="Completion date">
      <p className="mb-2 text-sm text-muted">Completion date</p>
      <div className="flex flex-wrap gap-2">
        {deadlines.map((option) => (
          <GhostButton
            key={option.id}
            type="button"
            className="px-3"
            onClick={() => applyDeadline(option.at)}
          >
            {option.label}
          </GhostButton>
        ))}
        {task.deadline != null && (
          <QuietButton type="button" onClick={() => applyDeadline(null)}>
            Clear date
          </QuietButton>
        )}
      </div>
      <input
        aria-label="Completion date and time"
        type="datetime-local"
        className={cn(fieldClass, "mt-2")}
        value={toLocalInput(task.deadline)}
        onChange={(event) => applyDeadline(fromLocalInput(event.target.value))}
      />

      <p className="mt-4 mb-2 text-sm text-muted">Alarm</p>
      <div className="grid grid-cols-2 gap-2">
        <AlarmButton active={choice === "none"} onClick={() => applyAlarm("none")} label="None" />
        <AlarmButton
          active={choice === "at"}
          disabled={task.deadline == null}
          onClick={() => applyAlarm("at")}
          label="When due"
        />
        <AlarmButton
          active={choice === "15"}
          disabled={task.deadline == null}
          onClick={() => applyAlarm("15")}
          label="15 min before"
        />
        <AlarmButton
          active={choice === "60"}
          disabled={task.deadline == null}
          onClick={() => applyAlarm("60")}
          label="1 hour before"
        />
      </div>
      {(customAlarm || choice === "custom") && (
        <>
          <label htmlFor="task-alarm" className="mt-3 mb-2 block text-sm text-muted">
            Custom alarm
          </label>
          <input
            id="task-alarm"
            type="datetime-local"
            className={fieldClass}
            value={choice === "custom" ? toLocalInput(task.alarmAt) : ""}
            onChange={(event) => {
              const alarmAt = fromLocalInput(event.target.value);
              if (alarmAt == null) {
                updateTask(task.id, { alarmAt: null });
                return;
              }
              if (alarmAt <= Date.now()) {
                setHint("Pick a future time for the alarm.");
                return;
              }
              setHint("");
              updateTask(task.id, { alarmAt });
            }}
          />
        </>
      )}
      {choice !== "custom" && !customAlarm && (
        <GhostButton type="button" className="mt-2" onClick={() => setCustomAlarm(true)}>
          Custom time
        </GhostButton>
      )}
      {hint && <p className="mt-2 text-sm text-signal">{hint}</p>}
      <AlertNote
        alerts={alerts}
        onAllow={() => {
          void requestAlerts().then(setAlerts);
        }}
      />
    </section>
  );
}

function AlarmButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <GhostButton
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn("px-3", active && "border-brass text-brass")}
    >
      <Bell className="size-4" />
      {label}
    </GhostButton>
  );
}

function AlertNote({
  alerts,
  onAllow,
}: {
  alerts: NotificationPermission | "unsupported";
  onAllow: () => void;
}) {
  if (alerts === "granted") {
    return <p className="mt-2 text-sm text-muted">Browser alerts are on. The in-app alarm rings too.</p>;
  }
  if (alerts === "unsupported") {
    return (
      <p className="mt-2 text-sm text-muted">
        This browser has no alerts. The in-app alarm still rings while Mission is open.
      </p>
    );
  }
  if (alerts === "denied") {
    return (
      <p className="mt-2 text-sm text-muted">
        Browser alerts are blocked. The in-app alarm still rings while Mission is open.
      </p>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <p className="text-sm text-muted">Rings while Mission is open.</p>
      <QuietButton type="button" className="text-brass hover:text-brass" onClick={onAllow}>
        Allow browser alerts
      </QuietButton>
    </div>
  );
}
