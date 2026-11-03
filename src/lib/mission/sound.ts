let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) ctx = new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

export function unlockAudio() {
  const audio = getCtx();
  if (audio && audio.state === "suspended") void audio.resume();
}

function tone(
  audio: AudioContext,
  when: number,
  freq: number,
  duration: number,
  type: OscillatorType,
) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.05, when + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(when);
  osc.stop(when + duration + 0.02);
}

export function playAlarm() {
  const audio = getCtx();
  if (!audio) return;
  void audio.resume();
  const now = audio.currentTime;
  tone(audio, now, 880, 0.16, "square");
  tone(audio, now + 0.2, 660, 0.28, "square");
}

export function playClear() {
  const audio = getCtx();
  if (!audio) return;
  void audio.resume();
  const now = audio.currentTime;
  tone(audio, now, 523, 0.1, "triangle");
  tone(audio, now + 0.12, 659, 0.1, "triangle");
  tone(audio, now + 0.24, 784, 0.2, "triangle");
}

export function playWand() {
  const audio = getCtx();
  if (!audio) return;
  void audio.resume();
  const now = audio.currentTime;
  const notes = [659, 784, 988, 1175, 1319, 1568, 1976];
  notes.forEach((freq, index) => {
    spark(audio, now + index * 0.055, freq, 0.28);
  });
  spark(audio, now + 0.46, 2349, 0.5);
}

function spark(audio: AudioContext, when: number, freq: number, duration: number) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, when);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.4, when + duration);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.07, when + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(when);
  osc.stop(when + duration + 0.02);
}

export function playFail() {
  const audio = getCtx();
  if (!audio) return;
  void audio.resume();
  const now = audio.currentTime;
  tone(audio, now, 311, 0.18, "triangle");
  tone(audio, now + 0.2, 196, 0.36, "triangle");
}

export function notifyTask(title: string, body: string, tag: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag });
  } catch {
    // The in-app banner still covers the alarm.
  }
}

export async function requestAlerts(): Promise<"granted" | "denied" | "default" | "unsupported"> {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}
