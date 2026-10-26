import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useAcademicYear } from "../../hooks/useAcademicYear";
import { listColleges } from "../../services/firebase/colleges";
import { backfillBookingCollegeIds, functionsErrorMessage, saveAcademicYear } from "../../services/firebase/functions";
import type { College } from "../../types/college";
import type { AcademicYear } from "../../types/academicYear";
import { formatDateDMY } from "../../utils/formatDate";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Modal } from "../../components/common/Modal";
import { AcademicYearCollegeActions } from "../../components/academicYear/AcademicYearCollegeActions";
import { listCampuses } from "../../services/firebase/campuses";
import "./AcademicYearsSection.css";

interface FormState {
  id?: string;
  label: string;
  start: string; // yyyy-mm-dd
  end: string;
  collegeIds: string[];
  status: "active" | "closed";
}

const EMPTY_FORM: FormState = { label: "", start: "", end: "", collegeIds: [], status: "active" };

function toInputDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Local start of the first day / end of the last day, so the whole of both
// dates is inside the year.
function startOfDay(value: string): number {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}
function endOfDay(value: string): number {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

export function AcademicYearsSection() {
  const { profile } = useAuth();
  const { years, reload, loading } = useAcademicYear();
  const campusId = profile?.campusId ?? "";
  const [colleges, setColleges] = useState<College[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [backfillMessage, setBackfillMessage] = useState("");
  const [backfilling, setBackfilling] = useState(false);
  const [campusName, setCampusName] = useState("Campus");

  useEffect(() => {
    if (campusId) {
      listColleges(campusId).then(setColleges);
      listCampuses().then((list) => setCampusName(list.find((c) => c.id === campusId)?.name ?? "Campus"));
    }
  }, [campusId]);

  const collegeName = (id: string) => colleges.find((c) => c.id === id)?.name ?? "Unknown college";
  const campusYears = years.filter((y) => y.campusId === campusId);

  function openCreate() {
    setError("");
    setForm({ ...EMPTY_FORM });
  }

  function openEdit(year: AcademicYear) {
    setError("");
    setForm({
      id: year.id,
      label: year.label,
      start: toInputDate(year.startDate),
      end: toInputDate(year.endDate),
      collegeIds: year.collegeIds,
      status: year.status,
    });
  }

  function toggleCollege(id: string) {
    setForm((f) =>
      f ? { ...f, collegeIds: f.collegeIds.includes(id) ? f.collegeIds.filter((c) => c !== id) : [...f.collegeIds, id] } : f,
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form || !campusId) return;
    if (!form.label.trim() || !form.start || !form.end) {
      setError("Enter a label, a start date and an end date.");
      return;
    }
    if (form.collegeIds.length === 0) {
      setError("Assign at least one college to this academic year.");
      return;
    }
    if (endOfDay(form.end) <= startOfDay(form.start)) {
      setError("The end date must be after the start date.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveAcademicYear({
        id: form.id,
        campusId,
        label: form.label.trim(),
        startDate: startOfDay(form.start),
        endDate: endOfDay(form.end),
        collegeIds: form.collegeIds,
        status: form.status,
      });
      await reload();
      setForm(null);
    } catch (err) {
      setError(functionsErrorMessage(err, "Could not save the academic year. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  async function handleBackfill() {
    setBackfilling(true);
    setBackfillMessage("");
    try {
      const updated = await backfillBookingCollegeIds();
      setBackfillMessage(
        updated > 0
          ? `Updated ${updated} older session${updated === 1 ? "" : "s"} with their college.`
          : "Every session already has its college recorded.",
      );
    } catch (err) {
      setBackfillMessage(functionsErrorMessage(err, "Could not update older sessions. Please try again."));
    } finally {
      setBackfilling(false);
    }
  }

  return (
    <div className="academic-years">
      <div className="academic-years__header">
        <p className="academic-years__intro">
          Define each academic year for your campus and which colleges follow it. Every dashboard and report is then
          filtered to the year chosen in the header. A college can only be in one year at a time — years can&apos;t
          overlap for the same college.
        </p>
        <Button type="button" onClick={openCreate}>
          + New academic year
        </Button>
      </div>

      {!loading && campusYears.length === 0 && (
        <p>No academic years yet. Create one to start organising records by year.</p>
      )}

      {campusYears.map((year) => (
        <Card key={year.id} className="academic-years__row">
          <div className="academic-years__row-main">
            <p className="academic-years__label">
              {year.label}
              <span className={`academic-years__badge academic-years__badge--${year.status}`}>
                {year.status === "active" ? "Active" : "Closed"}
              </span>
            </p>
            <p className="academic-years__dates">
              {formatDateDMY(year.startDate)} – {formatDateDMY(year.endDate)}
            </p>
            <p className="academic-years__colleges">
              Data is grouped by college. Export or search a college&apos;s records here; live records stay saved in the database.
            </p>
            {year.collegeIds.map((collegeId) => (
              <AcademicYearCollegeActions
                key={collegeId}
                year={year}
                collegeId={collegeId}
                collegeName={collegeName(collegeId)}
                campusName={campusName}
              />
            ))}
          </div>
          <Button type="button" variant="outlined" onClick={() => openEdit(year)}>
            Edit
          </Button>
        </Card>
      ))}

      <Card className="academic-years__tools">
        <p className="academic-years__tools-title">Older sessions</p>
        <p className="academic-years__intro">
          Sessions booked before academic years existed don&apos;t record their college. Run this once so they appear
          under the right college.
        </p>
        <div>
          <Button type="button" variant="outlined" onClick={handleBackfill} disabled={backfilling}>
            {backfilling ? "Updating…" : "Update older sessions"}
          </Button>
        </div>
        {backfillMessage && <p className="academic-years__intro">{backfillMessage}</p>}
      </Card>

      {form && (
        <Modal title={form.id ? "Edit academic year" : "New academic year"} onClose={() => setForm(null)}>
          <form className="academic-years__form" onSubmit={handleSubmit}>
            <label className="academic-years__field">
              <span>Label</span>
              <input
                type="text"
                value={form.label}
                placeholder="e.g. 2025–26"
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </label>
            <div className="academic-years__field-row">
              <label className="academic-years__field">
                <span>From</span>
                <input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
              </label>
              <label className="academic-years__field">
                <span>To</span>
                <input type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
              </label>
            </div>

            <fieldset className="academic-years__colleges-field">
              <legend>Colleges in this year</legend>
              {colleges.length === 0 && <p>No colleges on this campus yet.</p>}
              {colleges.map((college) => (
                <label key={college.id} className="academic-years__check">
                  <input
                    type="checkbox"
                    checked={form.collegeIds.includes(college.id)}
                    onChange={() => toggleCollege(college.id)}
                  />
                  <span>{college.name}</span>
                </label>
              ))}
            </fieldset>

            <label className="academic-years__check">
              <input
                type="checkbox"
                checked={form.status === "closed"}
                onChange={(e) => setForm({ ...form, status: e.target.checked ? "closed" : "active" })}
              />
              <span>Mark this year as closed</span>
            </label>

            {error && <p className="academic-years__error">{error}</p>}

            <div className="academic-years__actions">
              <Button type="button" variant="outlined" onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
