import { useAcademicYear } from "../../hooks/useAcademicYear";
import { Select } from "./Select";
import "./AcademicYearSelector.css";

/** Header dropdown that sets the academic year every dashboard view is scoped to. */
export function AcademicYearSelector() {
  const { labels, selectedLabel, setSelectedLabel } = useAcademicYear();
  if (labels.length === 0) return null;

  return (
    <div className="academic-year-selector">
      <span className="academic-year-selector__label">Academic year</span>
      <Select id="academic-year-selector" value={selectedLabel} onChange={setSelectedLabel}>
        {labels.map((label) => (
          <option key={label} value={label}>
            {label}
          </option>
        ))}
      </Select>
    </div>
  );
}
