import type { College } from "../../types/college";
import { Select } from "../common/Select";
import "./CollegePicker.css";

interface CollegePickerProps {
  colleges: College[];
  selectedId: string;
  onSelect: (collegeId: string) => void;
}

export function CollegePicker({ colleges, selectedId, onSelect }: CollegePickerProps) {
  if (colleges.length === 0) {
    return <p className="college-picker__empty">No colleges have been added for this campus yet.</p>;
  }

  return (
    <div className="college-picker">
      <label htmlFor="college-picker-select">College</label>
      <Select id="college-picker-select" value={selectedId} onChange={onSelect}>
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
