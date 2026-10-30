import { useEffect, useState } from "react";
import { BentoCard } from "../common/BentoCard";
import { Button } from "../common/Button";
import { useAuth } from "../../hooks/useAuth";
import {
  cameraCheckIn,
  cameraCheckOut,
  formatDuration,
  formatIstDateLabel,
  formatIstTime,
  getAttendanceRecord,
  isIstSunday,
  istDateKey,
} from "../../services/firebase/attendance";
import {
  subscribeLocationsForUser,
} from "../../services/firebase/cameraLocations";
import { backfillFaceProfileCampusId, getFaceProfile, type FaceProfile } from "../../services/firebase/faceProfiles";
import { subscribeActiveLeavesToday, formatLeaveRange } from "../../services/firebase/leaves";
import type { AttendanceRecord } from "../../types/attendance";
import type { CameraLocation } from "../../types/cameraLocation";
import type { LeaveRequest } from "../../types/leave";
import { CameraCheckModal } from "./CameraCheckModal";
import { FaceRegisterModal } from "./FaceRegisterModal";
import "./AttendanceCheckCard.css";

interface AttendanceCheckCardProps {
  span?: 3 | 4 | 6 | 8 | 12;
}

/** Today's camera-based check-in / check-out for counsellors and heads.
    Shared by both home screens; the same records are shown on the profile page. */
export function AttendanceCheckCard({ span = 4 }: AttendanceCheckCardProps) {
  const { currentUser, profile } = useAuth();
  const uid = currentUser?.uid;
  const campusId = profile?.campusId;
  const role = profile?.role;
  const eligible = role === "counsellor" || role === "head";
  const [activeLeave, setActiveLeave] = useState<LeaveRequest | null>(null);
  const isManuallyUnavailable = profile?.available === false;
  const onLeave = isManuallyUnavailable || Boolean(activeLeave);

  const [dateKey] = useState(() => istDateKey(Date.now()));
  const [isSunday] = useState(() => isIstSunday(Date.now()));
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"in" | "out" | null>(null);
  const [locations, setLocations] = useState<CameraLocation[]>([]);
  const [faceProfile, setFaceProfile] = useState<FaceProfile | null | undefined>(undefined);
  const [registering, setRegistering] = useState(false);

  // Subscribe to real-time active approved leaves today
  useEffect(() => {
    if (!uid || !eligible) return;
    const unsub = subscribeActiveLeavesToday((map) => {
      setActiveLeave(map[uid] || null);
    });
    return () => unsub();
  }, [uid, eligible]);

  // This login's own two camera slots (Location 1 / Location 2)
  useEffect(() => {
    if (!uid || !eligible) return;
    return subscribeLocationsForUser(uid, setLocations);
  }, [uid, eligible]);

  // Face registration status — check-in/out stays locked until this exists.
  useEffect(() => {
    if (!uid || !eligible) return;
    let active = true;
    getFaceProfile(uid).then(async (p) => {
      // A profile registered before `campusId` was added to this doc (an
      // older test enrollment, from before Head-side management/reset
      // shipped) is invisible to the Head's management view — their read
      // rule needs campusId to confirm it's in-scope. Self-heal it the
      // moment the owner's own card loads, rather than leaving it stuck.
      if (p && !p.campusId && campusId) {
        await backfillFaceProfileCampusId(uid, campusId);
        p = { ...p, campusId };
      }
      if (active) setFaceProfile(p);
    });
    return () => {
      active = false;
    };
  }, [uid, eligible, campusId]);

  useEffect(() => {
    if (!uid || !eligible || onLeave) return;
    let active = true;
    getAttendanceRecord(uid, dateKey)
      .then((r) => {
        if (active) setRecord(r);
      })
      .catch(() => {
        if (active) setError("Couldn't load today's attendance.");
      });
    return () => {
      active = false;
    };
  }, [uid, eligible, onLeave, dateKey]);

  if (!eligible) return null;

  async function handleCheckIn({ location, photoBlob }: { location: CameraLocation; photoBlob: Blob }) {
    if (!uid || !campusId || onLeave || isSunday) return;
    setBusy(true);
    setError(null);
    try {
      await cameraCheckIn({
        uid,
        campusId,
        date: dateKey,
        locationId: location.id,
        locationName: location.name,
        photoBlob,
      });
      setRecord(await getAttendanceRecord(uid, dateKey));
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckOut({ location, photoBlob }: { location: CameraLocation; photoBlob: Blob }) {
    if (!uid || onLeave || isSunday) return;
    setBusy(true);
    setError(null);
    try {
      await cameraCheckOut({
        uid,
        date: dateKey,
        locationId: location.id,
        locationName: location.name,
        photoBlob,
      });
      setRecord(await getAttendanceRecord(uid, dateKey));
    } finally {
      setBusy(false);
    }
  }

  const checkedIn = record?.checkInAt != null;
  const checkedOut = record?.checkOutAt != null;

  return (
    <BentoCard
      span={span}
      title="Attendance"
      subtitle={formatIstDateLabel(dateKey)}
      className="attn-card"
    >
      {isSunday ? (
        <div className="attn-leave-box">
          <span className="attn-leave-badge">Sunday</span>
          <p className="attn-leave-text">
            It's Sunday — check-in and check-out aren't required today.
          </p>
        </div>
      ) : onLeave ? (
        <div className="attn-leave-box">
          <span className="attn-leave-badge">On Leave</span>
          <p className="attn-leave-text">
            {activeLeave
              ? `You have an approved ${activeLeave.type.toUpperCase()} leave active today (${formatLeaveRange(activeLeave)}). Attendance check-in and check-out are disabled.`
              : "You're marked unavailable today, so attendance check-in and check-out are turned off."}
          </p>
        </div>
      ) : faceProfile === undefined ? (
        <div className="attn">
          <p className="attn-muted">Loading…</p>
        </div>
      ) : faceProfile === null ? (
        <div className="attn">
          <p className="attn-status">You haven't registered your face yet.</p>
          <p className="attn-muted">
            Register once — it takes a few seconds — and every future check-in/check-out is matched against it.
            Check-in and check-out stay locked until you do.
          </p>
          <div className="attn-actions">
            <Button type="button" onClick={() => setRegistering(true)}>
              Register Face
            </Button>
          </div>
        </div>
      ) : (
        <div className="attn">
          <p className="attn-registered">✓ Face registered</p>
          <p className="attn-status">
            {checkedIn && checkedOut
              ? `Checked in ${formatIstTime(record!.checkInAt!)} · out ${formatIstTime(record!.checkOutAt!)} — Present ✓`
              : checkedIn
                ? `Checked in at ${formatIstTime(record!.checkInAt!)}${record!.checkInLocationName ? ` (${record!.checkInLocationName})` : ""} — check-out pending`
                : "Not checked in yet"}
          </p>
          {checkedIn && checkedOut && (
            <p className="attn-muted">Worked {formatDuration(record!.checkOutAt! - record!.checkInAt!)}</p>
          )}
          <div className="attn-actions">
            {!checkedIn && (
              <Button
                type="button"
                disabled={busy || !campusId || locations.length === 0}
                onClick={() => setModal("in")}
              >
                {busy ? "Saving…" : "Check In"}
              </Button>
            )}
            {checkedIn && !checkedOut && (
              <Button
                type="button"
                disabled={busy || locations.length === 0}
                onClick={() => setModal("out")}
              >
                {busy ? "Saving…" : "Check Out"}
              </Button>
            )}
          </div>
          {!checkedIn && locations.length === 0 && (
            <p className="attn-muted">
              No camera locations are available for your campus yet — ask your Head or Admin to add one.
            </p>
          )}
          {error && <p className="attn-error">{error}</p>}
        </div>
      )}

      {registering && uid && campusId && (
        <FaceRegisterModal
          uid={uid}
          campusId={campusId}
          onDone={() => {
            setRegistering(false);
            getFaceProfile(uid).then(setFaceProfile);
          }}
          onClose={() => setRegistering(false)}
        />
      )}

      {modal === "in" && (
        <CameraCheckModal
          title="Face Check-in"
          locations={locations}
          onSubmit={handleCheckIn}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "out" && (
        <CameraCheckModal
          title="Face Check-out"
          locations={locations}
          onSubmit={handleCheckOut}
          onClose={() => setModal(null)}
        />
      )}
    </BentoCard>
  );
}
