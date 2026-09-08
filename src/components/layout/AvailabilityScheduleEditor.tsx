import type { DayAvailability } from "../../types/availability";
import { TimePicker } from "../common/TimePicker";
import "./AvailabilityScheduleEditor.css";

interface AvailabilityScheduleEditorProps {
  value: DayAvailability[];
  onChange: (next: DayAvailability[]) => void;
}

export function AvailabilityScheduleEditor({ value, onChange }: AvailabilityScheduleEditorProps) {
  function updateDay(day: DayAvailability["day"], patch: Partial<DayAvailability>) {
    onChange(value.map((d) => (d.day === day ? { ...d, ...patch } : d)));
  }

  return (
    <div className="availability-editor">
      {value.map((d) => (
        <div key={d.day} className="availability-editor__row">
          <label className="availability-editor__day">
            <input
              type="checkbox"
              checked={d.enabled}
              onChange={(e) => updateDay(d.day, { enabled: e.target.checked })}
            />
            {d.day}
          </label>
          <TimePicker
            value={d.start ?? ""}
            disabled={!d.enabled}
            onChange={(value) => updateDay(d.day, { start: value })}
          />
          <span className="availability-editor__to">to</span>
          <TimePicker
            value={d.end ?? ""}
            disabled={!d.enabled}
            onChange={(value) => updateDay(d.day, { end: value })}
          />
        </div>
      ))}
    </div>
  );
}
