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
  startYear: number;
  collegeIds: string[];
  status: "active" | "closed";
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function datesForStartYear(startYear: number) {
  return {
    label: `${startYear}-${String(startYear + 1).slice(-2)}`,
    startDate: Date.UTC(startYear, 5, 1) - IST_OFFSET_MS,
    endDate: Date.UTC(startYear + 1, 5, 1) - IST_OFFSET_MS - 1,
  };
}

function startYearFromTimestamp(timestamp: number): number {
  return new Date(timestamp + IST_OFFSET_MS).getUTCFullYear();
}

function currentAcademicYearStart(now = new Date()): number {
  return now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
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
  const nextStartYear = () => Math.max(
    currentAcademicYearStart(),
    ...campusYears.map((year) => startYearFromTimestamp(year.startDate) + 1),
  );

  function openCreate() {
    setError("");
    setForm({ startYear: nextStartYear(), collegeIds: colleges.map((college) => college.id), status: "active" });
  }

  function openEdit(year: AcademicYear) {
    setError("");
    setForm({
      id: year.id,
      startYear: startYearFromTimestamp(year.startDate),
      collegeIds: colleges.map((college) => college.id),
      status: year.status,
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form || !campusId) return;
    if (!Number.isInteger(form.startYear) || form.startYear < 2000 || form.startYear > 2099) {
      setError("Enter a valid academic year start year.");
      return;
    }
    if (form.collegeIds.length === 0) {
      setError("This campus needs at least one college before an academic year can be created.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const dates = datesForStartYear(form.startYear);
      await saveAcademicYear({
        id: form.id,
        campusId,
        ...dates,
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
              <span>Academic year start</span>
              <input
                type="number"
                min={2000}
                max={2099}
                step={1}
                value={form.startYear}
                onChange={(e) => setForm({ ...form, startYear: Number(e.target.value) })}
                placeholder="e.g. 2025–26"
              />
            </label>
            <div className="academic-years__field-row">
              <label className="academic-years__field">
                <span>From</span>
                <p>June 1, {form.startYear}</p>
              </label>
              <label className="academic-years__field">
                <span>To</span>
                <p>May 31, {form.startYear + 1}</p>
              </label>
            </div>
            <p className="academic-years__intro">All campuses use June 1 through May 31 in India time. The year label and dates follow this fixed calendar.</p>

            <fieldset className="academic-years__colleges-field">
              <legend>Campus colleges</legend>
              <p>Every college on this campus uses the same academic-year dates.</p>
              {colleges.length === 0 && <p>No colleges on this campus yet.</p>}
              {colleges.map((college) => (
                <label key={college.id} className="academic-years__check">
                  <input
                    type="checkbox"
                    checked={form.collegeIds.includes(college.id)}
                    disabled
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
