import { useEffect, useState } from "react";
import { BentoCard } from "../common/BentoCard";
import { Button } from "../common/Button";
import { useAuth } from "../../hooks/useAuth";
import {
  checkIn,
  checkOut,
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
import { subscribeActiveLeavesToday, formatLeaveRange } from "../../services/firebase/leaves";
import type { AttendanceRecord } from "../../types/attendance";
import type { CameraLocation } from "../../types/cameraLocation";
import type { LeaveRequest } from "../../types/leave";
import { distanceMeters } from "../../utils/geo";
import "./AttendanceCheckCard.css";

interface AttendanceCheckCardProps {
  span?: 3 | 4 | 6 | 8 | 12;
}

/** Today's location-based check-in / check-out for counsellors and heads.
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
  const [locations, setLocations] = useState<CameraLocation[]>([]);
  const [locationsLoaded, setLocationsLoaded] = useState(false);
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [actionPhase, setActionPhase] = useState<"locating" | "saving" | null>(null);

  // Subscribe to real-time active approved leaves today
  useEffect(() => {
    if (!uid || !eligible) return;
    const unsub = subscribeActiveLeavesToday((map) => {
      setActiveLeave(map[uid] || null);
    });
    return () => unsub();
  }, [uid, eligible]);

  // This login's own two assigned check-in locations
  useEffect(() => {
    if (!uid || !eligible) return;
    return subscribeLocationsForUser(uid, (nextLocations) => {
      setPosition(null);
      setLocationError(null);
      setLocationsLoaded(true);
      setLocations(nextLocations);
    }, () => {
      setPosition(null);
      setLocations([]);
      setLocationsLoaded(true);
      setLocationError("Couldn't load your assigned check-in locations. Please try again later.");
    });
  }, [uid, eligible]);

  // Use bounded one-shot requests so location detection always resolves with
  // either a fix or an actionable error instead of waiting indefinitely.
  useEffect(() => {
    if (!eligible || !locationsLoaded || locations.length === 0) return;
    let active = true;
    setPosition(null);
    setLocating(true);
    setLocationError(null);
    requestLocationFix()
      .then((nextPosition) => {
        if (active) setPosition(nextPosition);
      })
      .catch((geoError: unknown) => {
        if (!active) return;
        setPosition(null);
        setLocationError(geoError instanceof Error ? geoError.message : "Couldn't determine your location.");
      })
      .finally(() => {
        if (active) setLocating(false);
      });
    return () => {
      active = false;
    };
  }, [eligible, locationsLoaded, locations]);

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

  const matchingLocation = position ? getVerifiedLocation(position, locations) : null;

  if (!eligible) return null;

  async function refreshLocation() {
    if (locating || locations.length === 0 || !geolocationSupported) return;
    setLocating(true);
    setLocationError(null);
    try {
      setPosition(await requestLocationFix());
    } catch (geoError) {
      setLocationError(geoError instanceof Error ? geoError.message : "Couldn't determine your location.");
    } finally {
      setLocating(false);
    }
  }

  async function handleAttendanceAction(action: "check-in" | "check-out") {
    if (!uid || !campusId || onLeave || isSunday || busy || !geolocationSupported) return;
    setBusy(true);
    setActionPhase("locating");
    setError(null);
    setLocationError(null);
    let savingAttendance = false;
    try {
      const currentPosition = await requestLocationFix();
      setPosition(currentPosition);
      const verifiedLocation = getVerifiedLocation(currentPosition, locations);
      if (!verifiedLocation) {
        setLocationError("Your current location is outside your assigned check-in locations.");
        return;
      }

      setLocationError(null);
      setActionPhase("saving");
      savingAttendance = true;
      if (action === "check-in") {
        await checkIn({
          uid,
          campusId,
          date: dateKey,
          locationId: verifiedLocation.id,
          locationName: verifiedLocation.name,
        });
      } else {
        await checkOut({
          uid,
          date: dateKey,
          locationId: verifiedLocation.id,
          locationName: verifiedLocation.name,
        });
      }
      setRecord(await getAttendanceRecord(uid, dateKey));
      setLocationError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't complete attendance. Please try again.";
      if (!savingAttendance) setLocationError(message);
      else setError(message);
    } finally {
      setActionPhase(null);
      setBusy(false);
    }
  }

  const checkedIn = record?.checkInAt != null;
  const checkedOut = record?.checkOutAt != null;
  const geolocationSupported =
    typeof navigator !== "undefined" && Boolean(navigator.geolocation);

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
      ) : (
        <div className="attn">
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
          {locations.length > 0 && !checkedOut && (
            <div className="attn-location">
              <p
                className={
                  matchingLocation
                    ? "attn-registered"
                    : locationError
                      ? "attn-error"
                      : "attn-muted"
                }
                role="status"
              >
                {matchingLocation
                  ? `Within ${matchingLocation.name}`
                  : !geolocationSupported
                    ? "This device or browser doesn't support location access."
                    : locationError ??
                      (locating
                        ? "Finding your location…"
                        : position
                          ? "Outside your assigned check-in locations."
                          : "Location hasn't been confirmed yet.")}
              </p>
              {locationError && matchingLocation && (
                <p className="attn-error" role="alert">{locationError}</p>
              )}
              {geolocationSupported && (
                <Button
                  type="button"
                  variant="outlined"
                  className="attn-location__refresh"
                  disabled={locating || busy}
                  onClick={() => void refreshLocation()}
                >
                  {locating ? "Finding location…" : "Refresh location"}
                </Button>
              )}
            </div>
          )}
          <div className="attn-actions">
            {!checkedIn && (
              <Button
                type="button"
                disabled={busy || !campusId || !geolocationSupported || !matchingLocation}
                onClick={() => void handleAttendanceAction("check-in")}
              >
                {actionPhase === "locating"
                  ? "Checking location…"
                  : actionPhase === "saving"
                    ? "Saving…"
                    : "Check In"}
              </Button>
            )}
            {checkedIn && !checkedOut && (
              <Button
                type="button"
                disabled={busy || !geolocationSupported || !matchingLocation}
                onClick={() => void handleAttendanceAction("check-out")}
              >
                {actionPhase === "locating"
                  ? "Checking location…"
                  : actionPhase === "saving"
                    ? "Saving…"
                    : "Check Out"}
              </Button>
            )}
          </div>
          {!checkedIn && locations.length === 0 && (
            <p className={locationError ? "attn-error" : "attn-muted"}>
              {locationsLoaded
                ? locationError ?? "No check-in locations are assigned yet — ask your Head or Admin to add one."
                : "Loading your assigned check-in locations…"}
            </p>
          )}
          {error && <p className="attn-error">{error}</p>}
        </div>
      )}
    </BentoCard>
  );
}

function getVerifiedLocation(
  position: GeolocationPosition,
  locations: CameraLocation[],
): CameraLocation | null {
  if (
    !Number.isFinite(position.coords.latitude) ||
    !Number.isFinite(position.coords.longitude) ||
    !Number.isFinite(position.coords.accuracy) ||
    position.coords.accuracy < 0
  ) {
    return null;
  }

  let closestLocation: CameraLocation | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const location of locations) {
    const distance = distanceMeters(
      position.coords.latitude,
      position.coords.longitude,
      location.latitude,
      location.longitude,
    );
    if (distance <= location.radiusMeters && distance < closestDistance) {
      closestLocation = location;
      closestDistance = distance;
    }
  }

  return closestLocation;
}

async function requestLocationFix(): Promise<GeolocationPosition> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("This device or browser doesn't support location access.");
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 12000,
      });
    });
    return position;
  } catch (error) {
    throw error instanceof Error ? error : locationRequestError(error);
  }
}

function locationRequestError(error: unknown): Error {
  if (typeof error === "object" && error !== null && "code" in error && error.code === 1) {
    return new Error("Allow location access in your browser, then try again.");
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === 3) {
    return new Error("Location timed out. Check that GPS or location services are enabled, then try again.");
  }
  return new Error("Couldn't get your location. Check GPS, location services, and your network, then try again.");
}
