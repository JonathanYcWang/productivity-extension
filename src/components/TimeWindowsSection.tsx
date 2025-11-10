import React from "react";
import { Settings, BlockWindow } from "../types";

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

interface TimeWindowsSectionProps {
  settings: Settings;
  onSave: (settings: Settings) => Promise<void>;
}

export function TimeWindowsSection({ settings, onSave }: TimeWindowsSectionProps) {
  const addWindow = async () => {
    const w: BlockWindow = { day: 1, start: "09:00", end: "17:00" };
    await onSave({ ...settings, windows: [...settings.windows, w] });
  };

  const updateWindow = async (idx: number, patch: Partial<BlockWindow>) => {
    const windows = settings.windows.slice();
    windows[idx] = { ...windows[idx], ...patch };
    await onSave({ ...settings, windows });
  };

  const removeWindow = async (idx: number) => {
    const windows = settings.windows.slice();
    windows.splice(idx, 1);
    await onSave({ ...settings, windows });
  };

  return (
    <section>
      <h2>Time windows</h2>
      <button onClick={addWindow}>Add window</button>
      {settings.windows.map((w, i) => (
        <div key={i} className="card">
          <label>
            Day:
            <select value={w.day} onChange={e => updateWindow(i, { day: Number(e.target.value) })}>
              {DAYS.map((d, idx) => (
                <option value={idx} key={idx}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            Start:
            <input type="time" value={w.start} onChange={e => updateWindow(i, { start: e.target.value })} />
          </label>
          <label>
            End:
            <input type="time" value={w.end} onChange={e => updateWindow(i, { end: e.target.value })} />
          </label>
          <button onClick={() => removeWindow(i)}>remove</button>
        </div>
      ))}
    </section>
  );
}

