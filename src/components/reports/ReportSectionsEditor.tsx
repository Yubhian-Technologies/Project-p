import { Button } from "../common/Button";
import { XIcon } from "../common/icons";
import type { ReportSection } from "../../types/report";
import "./ReportSectionsEditor.css";

interface ReportSectionsEditorProps {
  sections: ReportSection[];
  onChange: (sections: ReportSection[]) => void;
}

// Lets the counsellor/head build up the narrative parts of a report
// themselves — add as many headed sections as they want (e.g. "Meetings &
// Administrative Activities", "Goals for Next Month"), each with a list of
// bullet items (a short title + the actual detail text). Nothing here is
// auto-generated; it's typed in fresh each time a report is downloaded.
export function ReportSectionsEditor({ sections, onChange }: ReportSectionsEditorProps) {
  function addSection() {
    onChange([...sections, { heading: "", items: [{ title: "", details: "" }] }]);
  }

  function removeSection(sectionIndex: number) {
    onChange(sections.filter((_, i) => i !== sectionIndex));
  }

  function updateHeading(sectionIndex: number, heading: string) {
    onChange(sections.map((s, i) => (i === sectionIndex ? { ...s, heading } : s)));
  }

  function addItem(sectionIndex: number) {
    onChange(
      sections.map((s, i) => (i === sectionIndex ? { ...s, items: [...s.items, { title: "", details: "" }] } : s)),
    );
  }

  function removeItem(sectionIndex: number, itemIndex: number) {
    onChange(
      sections.map((s, i) =>
        i === sectionIndex ? { ...s, items: s.items.filter((_, j) => j !== itemIndex) } : s,
      ),
    );
  }

  function updateItem(sectionIndex: number, itemIndex: number, field: "title" | "details", value: string) {
    onChange(
      sections.map((s, i) =>
        i === sectionIndex
          ? { ...s, items: s.items.map((it, j) => (j === itemIndex ? { ...it, [field]: value } : it)) }
          : s,
      ),
    );
  }

  return (
    <div className="report-sections-editor">
      {sections.map((section, sectionIndex) => (
        <div key={sectionIndex} className="report-sections-editor__section">
          <div className="report-sections-editor__section-header">
            <input
              type="text"
              className="report-sections-editor__heading-input"
              placeholder="Section heading, e.g. Meetings & Administrative Activities"
              value={section.heading}
              onChange={(e) => updateHeading(sectionIndex, e.target.value)}
            />
            <button
              type="button"
              className="report-sections-editor__remove-section"
              aria-label="Remove section"
              onClick={() => removeSection(sectionIndex)}
            >
              <XIcon />
            </button>
          </div>

          {section.items.map((item, itemIndex) => (
            <div key={itemIndex} className="report-sections-editor__item">
              <input
                type="text"
                className="report-sections-editor__item-title"
                placeholder="Item name (optional), e.g. VEDIC Meeting"
                value={item.title}
                onChange={(e) => updateItem(sectionIndex, itemIndex, "title", e.target.value)}
              />
              <textarea
                className="report-sections-editor__item-details"
                rows={2}
                placeholder="Details"
                value={item.details}
                onChange={(e) => updateItem(sectionIndex, itemIndex, "details", e.target.value)}
              />
              <button
                type="button"
                className="report-sections-editor__remove-item"
                aria-label="Remove item"
                onClick={() => removeItem(sectionIndex, itemIndex)}
              >
                <XIcon />
              </button>
            </div>
          ))}

          <Button type="button" variant="outlined" onClick={() => addItem(sectionIndex)}>
            + Add item
          </Button>
        </div>
      ))}

      <Button type="button" variant="outlined" onClick={addSection}>
        + Add section
      </Button>
    </div>
  );
}
