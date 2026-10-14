import type { College } from "../../types/college";
import { Select } from "../common/Select";
import "./CollegePicker.css";

interface CollegePickerProps {
  colleges: College[];
  selectedId: string;
  onSelect: (collegeId: string) => void;
  /** True for a Counsellor, who's assigned to exactly one college — the
   *  dropdown is disabled rather than hidden, so it still reads the same as
   *  the enabled Head/Admin view, just fixed to that one college. */
  locked?: boolean;
}

export function CollegePicker({ colleges, selectedId, onSelect, locked }: CollegePickerProps) {
  if (colleges.length === 0) {
    return <p className="college-picker__empty">No colleges have been added for this campus yet.</p>;
  }

  return (
    <div className="college-picker">
      <label htmlFor="college-picker-select">College</label>
      <Select id="college-picker-select" value={selectedId} onChange={onSelect} disabled={locked}>
        <option value="" disabled>
          Select a college…
        </option>
        {colleges.map((college) => (
          <option key={college.id} value={college.id}>
            {college.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
