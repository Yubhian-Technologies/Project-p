import { Select } from "../../../components/common/Select";
import { pad, to12Hour, to24Hour } from "../../../utils/timeFormat";
import "./JournalReminderControls.css";

interface JournalReminderControlsProps {
  isReminder: boolean;
  onToggleReminder: (value: boolean) => void;
  reminderTime: string; // "HH:mm", 24-hour
  onChangeReminderTime: (value: string) => void;
}

export function JournalReminderControls({
  isReminder,
  onToggleReminder,
  reminderTime,
  onChangeReminderTime,
}: JournalReminderControlsProps) {
  const [hourPart, minutePart] = reminderTime.split(":");
  const hour24 = Number(hourPart) || 0;
  const minute = Number(minutePart) || 0;
  const { hour12, ampm } = to12Hour(hour24);

  function commit(nextHour24: number, nextMinute: number) {
    onChangeReminderTime(`${pad(nextHour24)}:${pad(nextMinute)}`);
  }

  return (
    <div className="journal-reminder">
      <label className="journal-reminder__toggle">
        <input type="checkbox" checked={isReminder} onChange={(e) => onToggleReminder(e.target.checked)} />
        Remind me on this date
      </label>

      {isReminder && (
        <div className="journal-reminder__time-row">
          <span className="journal-reminder__time-label">At</span>
          <Select value={String(hour12)} onChange={(v) => commit(to24Hour(Number(v), ampm), minute)}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
              <option key={h} value={String(h)}>
                {h}
              </option>
            ))}
          </Select>
          <Select value={String(minute)} onChange={(v) => commit(hour24, Number(v))}>
            {Array.from({ length: 60 }, (_, i) => i).map((m) => (
              <option key={m} value={String(m)}>
                {pad(m)}
              </option>
            ))}
          </Select>
          <Select value={ampm} onChange={(v) => commit(to24Hour(hour12, v as "AM" | "PM"), minute)}>
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </Select>
        </div>
      )}
    </div>
  );
}
