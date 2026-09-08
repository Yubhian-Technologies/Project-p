import type { DayAvailability } from "../../types/availability";
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
          <input
            type="time"
            value={d.start ?? ""}
            disabled={!d.enabled}
            onChange={(e) => updateDay(d.day, { start: e.target.value })}
          />
          <span className="availability-editor__to">to</span>
          <input
            type="time"
            value={d.end ?? ""}
            disabled={!d.enabled}
            onChange={(e) => updateDay(d.day, { end: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}
