import { Button } from "../common/Button";
import { XIcon } from "../common/icons";
import type { ReportStatRow } from "../../types/report";
import "./ReportStatRowsEditor.css";

interface ReportStatRowsEditorProps {
  rows: ReportStatRow[];
  onChange: (rows: ReportStatRow[]) => void;
}

// For Executive Summary figures the app has no data for at all — Digital
// Detox participants, MINDTAP episodes, Faculty Training status, etc. Typed
// in fresh each time, same as ReportSectionsEditor's items.
export function ReportStatRowsEditor({ rows, onChange }: ReportStatRowsEditorProps) {
  function addRow() {
    onChange([...rows, { label: "", value: "" }]);
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  function updateRow(index: number, field: "label" | "value", value: string) {
    onChange(rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  return (
    <div className="report-stat-rows-editor">
      {rows.map((row, index) => (
        <div key={index} className="report-stat-rows-editor__row">
          <input
            type="text"
            className="report-stat-rows-editor__label"
            placeholder="e.g. Digital Detox Programme Participants"
            value={row.label}
            onChange={(e) => updateRow(index, "label", e.target.value)}
          />
          <input
            type="text"
            className="report-stat-rows-editor__value"
            placeholder="e.g. 45"
            value={row.value}
            onChange={(e) => updateRow(index, "value", e.target.value)}
          />
          <button
            type="button"
            className="report-stat-rows-editor__remove"
            aria-label="Remove row"
            onClick={() => removeRow(index)}
          >
            <XIcon />
          </button>
        </div>
      ))}
      <Button type="button" variant="outlined" onClick={addRow}>
        + Add summary figure
      </Button>
    </div>
  );
}
