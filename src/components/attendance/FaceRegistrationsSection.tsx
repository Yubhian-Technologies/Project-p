import { useEffect, useState } from "react";
import { listBookableProfiles } from "../../services/firebase/bookings";
import { getFaceProfile, resetFaceProfile, type FaceProfile } from "../../services/firebase/faceProfiles";
import { useAuth } from "../../hooks/useAuth";
import { adminCanSeeStaff, allowedCampusIdsFor } from "../../utils/adminScope";
import type { UserProfile } from "../../types/user";
import { Card } from "../common/Card";
import { Button } from "../common/Button";
import { CampusFilterSelect } from "./CampusFilterSelect";
import "./FaceRegistrationsSection.css";

/**
 * Lets a Head (or scoped admin / super-admin) see who on their campus has
 * registered their face for camera check-in, and reset a registration so
 * the person can register again — the only way to re-enroll, since
 * firestore.rules deliberately block a person from overwriting their own
 * enrolled face. Includes the viewer's own row when they're a Head, so
 * they can reset (and then re-register) themselves too.
 *
 * Status is fetched per-person (getDoc), not a live collection listener —
 * Firestore rejects an unfiltered collection query outright whenever its
 * rule depends on resource.data fields the query doesn't filter on (it
 * can't prove every possible match would pass), which is exactly the case
 * here since different viewers are allowed different campuses' profiles.
 * A per-uid get() has no such restriction.
 */
export function FaceRegistrationsSection() {
  const { profile } = useAuth();
  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [profiles, setProfiles] = useState<Map<string, FaceProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [campusFilter, setCampusFilter] = useState("");
  const isAdminViewer = profile?.role === "admin" || profile?.role === "super-admin";

  useEffect(() => {
    let active = true;
    listBookableProfiles()
      .then(async (people) => {
        const scoped = people.filter(
          (p) =>
            (p.role === "counsellor" || p.role === "head") &&
            !!p.campusId &&
            // Mirrors CameraLocationsSection's scoping: a Head manages their
            // own campus; an Admin follows the same hierarchy as the rest of
            // the dashboard — Management (and legacy global) whole-campus,
            // Principal/VP/Administration narrowed to their assigned college(s).
            ((profile?.role === "head" && p.campusId === profile.campusId) ||
              (!!profile && (profile.role === "admin" || profile.role === "super-admin") &&
                adminCanSeeStaff(profile, p))),
        );
        if (active) setStaff(scoped);
        // One failed lookup shouldn't sink everyone else's status — treat it
        // as "unknown" (shown as not-registered) rather than letting
        // Promise.all reject and leave the whole section stuck loading.
        const entries = await Promise.all(
          scoped.map(async (p) => {
            try {
              return [p.uid, await getFaceProfile(p.uid)] as const;
            } catch (err) {
              console.error(`Failed to load face profile for ${p.uid}`, err);
              return [p.uid, null] as const;
            }
          }),
        );
        if (!active) return;
        setProfiles(new Map(entries.filter((e): e is [string, FaceProfile] => e[1] !== null)));
      })
      .catch((err) => console.error("Failed to load face registrations", err))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [profile?.role, profile?.campusId, profile?.adminAccess]);

  async function handleReset(uid: string, name: string) {
    if (!window.confirm(`Reset ${name}'s face registration? They'll need to register again before their next check-in/check-out.`)) {
      return;
    }
    setBusyUid(uid);
    try {
      await resetFaceProfile(uid);
      setProfiles((prev) => {
        const next = new Map(prev);
        next.delete(uid);
        return next;
      });
    } finally {
      setBusyUid(null);
    }
  }

  if (loading) return null;

  return (
    <div className="face-registrations">
      <div className="face-registrations__header">
        <div>
          <h3 className="face-registrations__heading">Face Registrations</h3>
          <p className="face-registrations__intro">
            Each counsellor and head registers their face once before they can check in or out — they can't
            re-register it themselves. If someone needs to register again (big appearance change, a bad first
            capture, etc.), reset their registration here; they'll be prompted to register again next time they open
            Attendance.
          </p>
        </div>
      </div>

      {isAdminViewer && profile && (
        <CampusFilterSelect
          value={campusFilter}
          onChange={setCampusFilter}
          allowedCampusIds={allowedCampusIdsFor(profile)}
        />
      )}

      {staff.length === 0 ? (
        <p className="face-registrations__empty">No counsellors or heads found for your campus.</p>
      ) : (
        staff
          .filter((p) => !campusFilter || p.campusId === campusFilter)
          .map((person) => {
          const faceProfile = profiles.get(person.uid);
          return (
            <Card key={person.uid} className="face-registrations__row">
              <div>
                <p className="face-registrations__name">{person.displayName || person.email}</p>
                <p className="face-registrations__meta">
                  {person.role === "head" ? "Head" : "Counsellor"}
                  {faceProfile ? ` · registered ${new Date(faceProfile.enrolledAt).toLocaleDateString()}` : ""}
                </p>
              </div>
              {faceProfile ? (
                <div className="face-registrations__actions">
                  <span className="face-registrations__badge face-registrations__badge--done">Registered</span>
                  <Button
                    type="button"
                    variant="outlined"
                    disabled={busyUid === person.uid}
                    onClick={() => handleReset(person.uid, person.displayName || person.email)}
                  >
                    {busyUid === person.uid ? "Resetting…" : "Reset Registration"}
                  </Button>
                </div>
              ) : (
                <span className="face-registrations__badge">Not registered</span>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
