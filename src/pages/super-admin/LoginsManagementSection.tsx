import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { listCampuses } from "../../services/firebase/campuses";
import { listColleges } from "../../services/firebase/colleges";
import { listCampusLogins } from "../../services/firebase/firestore";
import { deleteCampusLogin, functionsErrorMessage } from "../../services/firebase/functions";
import type { Campus } from "../../types/campus";
import type { College } from "../../types/college";
import type { UserProfile } from "../../types/user";
import { useViewMore } from "../../hooks/useViewMore";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Select } from "../../components/common/Select";
import { ROLE_LABELS } from "../../config/roles";
import { exportStaffData } from "../../services/firebase/managedAccounts";
import { downloadXlsx } from "../../utils/excelExport";
import { Modal } from "../../components/common/Modal";
import { AddLoginModal } from "./AddLoginModal";
import { EditLoginModal } from "./EditLoginModal";
import "./LoginsManagementSection.css";

export function LoginsManagementSection() {
  const { profile } = useAuth();
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [logins, setLogins] = useState<UserProfile[]>([]);
  const [campusId, setCampusId] = useState(() =>
    profile?.role === "admin" && profile.adminAccess?.scope === "campuses" && profile.adminAccess.campusIds?.length === 1
      ? profile.adminAccess.campusIds[0]
      : "");
  const [loadingCampuses, setLoadingCampuses] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editingLogin, setEditingLogin] = useState<UserProfile | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exportingLogin, setExportingLogin] = useState<UserProfile | null>(null);
  const [selectedExports, setSelectedExports] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportOptions = [
    { id: "sessions", label: "Session data", description: "Non-emergency counselling sessions (Excel)" },
    { id: "crisisSos", label: "Crisis SOS data", description: "Crisis SOS cases (Excel)" },
    { id: "feedback", label: "Session feedback", description: "Feedback records for this staff account (Excel)" },
    { id: "monthlyReports", label: "Monthly reports", description: "Download each submitted report separately" },
    { id: "consolidatedReports", label: "Consolidated reports", description: "Download each submitted report separately" },
  ];

  function toggleExport(id: string) {
    setSelectedExports((current) => id === "all"
      ? current.length === exportOptions.length ? [] : exportOptions.map((option) => option.id)
      : current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function downloadStaffExport(login: UserProfile) {
    if (!selectedExports.length) return;
    setExporting(true);
    setExportError(null);
    try {
      const payload = await exportStaffData(login.uid);
      const safeName = (login.displayName || login.email).replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "");
      const records = (value: unknown) => Array.isArray(value) ? value as Record<string, unknown>[] : [];
      const rowsFor = (items: Record<string, unknown>[]) => {
        const keys = [...new Set(items.flatMap((item) => Object.keys(item)))];
        return [keys, ...items.map((item) => keys.map((key) => {
          const value = item[key];
          return value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
        }))];
      };
      const downloadSheet = async (name: string, items: Record<string, unknown>[]) => {
        await downloadXlsx(`${safeName}-${name}.xlsx`, name.slice(0, 31), rowsFor(items));
      };
      const selected = new Set(selectedExports);
      const bookings = records(payload.bookings);
      if (selected.has("sessions")) {
        await downloadSheet("sessions", bookings.filter((booking) => booking.isEmergency !== true));
      }
      if (selected.has("crisisSos")) {
        const sos = bookings.filter((booking) => booking.isEmergency === true);
        const seriousCases = records(payload.seriousCases).filter((item) => item.isEmergency === true);
        const caseByBooking = new Map(seriousCases.map((item) => [String(item.bookingId ?? item.id), item]));
        const sosRows = sos.map((booking) => {
          const seriousCase = caseByBooking.get(String(booking.id));
          return seriousCase ? { ...booking, escalationDetails: JSON.stringify(seriousCase) } : booking;
        });
        await downloadSheet("crisis-sos", sosRows);
      }
      if (selected.has("feedback")) await downloadSheet("session-feedback", records(payload.feedback));

      const downloadReports = async (items: Record<string, unknown>[], fallback: string) => {
        for (const report of items) {
          const url = typeof report.downloadURL === "string" ? report.downloadURL : "";
          if (!url) continue;
          const filename = typeof report.fileName === "string" && report.fileName
            ? `${safeName}-${report.fileName}`
            : `${fallback}-${String(report.year ?? "")}-${String(report.month ?? "")}.pdf`;
          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          link.rel = "noopener";
          document.body.appendChild(link);
          link.click();
          link.remove();
          // Browsers may block a burst of multiple file downloads.
          await new Promise((resolve) => window.setTimeout(resolve, 300));
        }
      };
      if (selected.has("monthlyReports")) {
        await downloadReports(records(payload.counsellorMonthlyReports), "monthly-report");
      }
      if (selected.has("consolidatedReports")) {
        await downloadReports(records(payload.monthlyReports), "consolidated-report");
      }
      setExportingLogin(null);
    } catch (err) {
      setExportError(functionsErrorMessage(err, "Could not export this login's data. Please try again."));
    } finally {
      setExporting(false);
    }
  }

  // A campus-restricted Admin login only ever sees/picks their own assigned
  // campuses here — Super Admin and a global-scope Admin see every campus,
  // unchanged.
  const scopedCampusIds =
    profile?.role === "admin" && profile.adminAccess?.scope === "campuses"
      ? profile.adminAccess.campusIds ?? []
      : null;

  // When also narrowed to specific colleges, this admin can still SEE every
  // login on the campus (unchanged) but can only edit/delete — or add a new
  // login into — one of these colleges.
  const restrictedCollegeIds =
    scopedCampusIds && profile?.role === "admin" && profile.adminAccess?.collegeIds?.length
      ? profile.adminAccess.collegeIds
      : null;

  function canManageLogin(login: UserProfile): boolean {
    if (!restrictedCollegeIds) return true;
    return !!login.collegeId && restrictedCollegeIds.includes(login.collegeId);
  }

  useEffect(() => {
    listCampuses().then((c) => {
      const visible = scopedCampusIds ? c.filter((campus) => scopedCampusIds.includes(campus.id)) : c;
      setCampuses(visible);
      // Admin assigned to a single campus has nothing to choose.
      if (scopedCampusIds && visible.length === 1) setCampusId(visible[0].id);
      setLoadingCampuses(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadForCampus(id: string) {
    const [c, l] = await Promise.all([listColleges(id), listCampusLogins(id)]);
    setColleges(c);
    setLogins(l);
  }

  useEffect(() => {
    if (!campusId) {
      setColleges([]);
      setLogins([]);
      return;
    }
    loadForCampus(campusId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusId]);

  async function handleDelete(uid: string) {
    setDeleteError(null);
    setDeletingUid(uid);
    try {
      await deleteCampusLogin(uid);
      await loadForCampus(campusId);
    } catch (err) {
      setDeleteError(functionsErrorMessage(err, "Could not delete this login. Please try again."));
    } finally {
      setDeletingUid(null);
    }
  }

  const { visible: visibleLogins, hiddenCount, showMore } = useViewMore(logins);

  if (loadingCampuses) return null;

  const hideCampusPicker = scopedCampusIds?.length === 1;

  return (
    <div className="logins-management">
      <div className="logins-management__header">
        <Button type="button" onClick={() => setAddOpen(true)}>
          + Add Login
        </Button>
      </div>

      {!hideCampusPicker && (
      <div className="logins-management__filters">
        <div className="logins-management__field">
          <label htmlFor="logins-campus">Campus</label>
          <Select id="logins-campus" value={campusId} onChange={setCampusId}>
            <option value="" disabled>
              Select a campus…
            </option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      )}

      {deleteError && <p className="logins-management__error">{deleteError}</p>}
      {!campusId && scopedCampusIds?.length !== 1 && <p>Select a campus to view its logins.</p>}
      {campusId && logins.length === 0 && <p>No logins on this campus yet.</p>}

      {campusId &&
        visibleLogins.map((login) => (
          <Card key={login.uid} className="logins-management__row">
            <div>
              <p className="logins-management__name">
                {login.displayName || login.email}
                {login.active === false && <span className="logins-management__status-badge">Inactive</span>}
              </p>
              <p className="logins-management__role">{ROLE_LABELS[login.role]}</p>
              <p className="logins-management__college">
                {colleges.find((c) => c.id === login.collegeId)?.name ?? "—"}
              </p>
            </div>
            <div className="logins-management__row-actions">
              <Button
                type="button"
                variant="outlined"
                disabled={!canManageLogin(login)}
                title={canManageLogin(login) ? undefined : "Outside your assigned college(s) — view only"}
                onClick={() => setEditingLogin(login)}
              >
                Edit
              </Button>
              {login.active === false && (login.role === "counsellor" || login.role === "head") && (
                <Button type="button" variant="outlined" onClick={() => {
                  setExportingLogin(login);
                  setSelectedExports([]);
                  setExportError(null);
                }}>
                  Export data
                </Button>
              )}
<Button
  type="button"
  variant="outlined"
  disabled={deletingUid === login.uid || !canManageLogin(login)}
  title={canManageLogin(login) ? undefined : "Outside your assigned college(s) — view only"}
  onClick={() => handleDelete(login.uid)}
>
  {deletingUid === login.uid ? "Deleting…" : "Delete login"}
</Button>
            </div>
          </Card>
        ))}

      {campusId && hiddenCount > 0 && (
        <Button type="button" variant="outlined" style={{ alignSelf: "center" }} onClick={showMore}>
          View More ({hiddenCount} more)
        </Button>
      )}

      {addOpen && (
        <AddLoginModal
          defaultCampusId={campusId || undefined}
          allowedCollegeIds={restrictedCollegeIds ?? undefined}
          onClose={() => setAddOpen(false)}
          onCreated={async () => {
            if (campusId) await loadForCampus(campusId);
          }}
        />
      )}

      {editingLogin && (
        <EditLoginModal
          login={editingLogin}
          colleges={colleges}
          onClose={() => setEditingLogin(null)}
          onSaved={() => loadForCampus(campusId)}
        />
      )}

      {exportingLogin && (
        <Modal title={`Export data — ${exportingLogin.displayName || exportingLogin.email}`} onClose={() => !exporting && setExportingLogin(null)}>
          <div className="logins-management__export-options">
            <p>Select the records to download. Session and Crisis SOS data are Excel files; reports are downloaded as separate files.</p>
            <label className="logins-management__export-option">
              <input type="checkbox" checked={selectedExports.length === exportOptions.length} onChange={() => toggleExport("all")} />
              <span><strong>All data</strong><small>Download each selected data file and each report separately</small></span>
            </label>
            {exportOptions.map((option) => (
              <label className="logins-management__export-option" key={option.id}>
                <input type="checkbox" checked={selectedExports.includes(option.id)} onChange={() => toggleExport(option.id)} />
                <span><strong>{option.label}</strong><small>{option.description}</small></span>
              </label>
            ))}
            {exportError && <p className="logins-management__error">{exportError}</p>}
            <Button type="button" disabled={!selectedExports.length || exporting} onClick={() => downloadStaffExport(exportingLogin)}>
              {exporting ? "Preparing downloads…" : "Download selected data"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
