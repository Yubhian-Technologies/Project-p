import { useEffect, useMemo, useState } from "react";
import {
  clearCameraSlot,
  saveCameraLocation,
  slotLabel,
  subscribeAllCameraLocations,
} from "../../services/firebase/cameraLocations";
import { listBookableProfiles } from "../../services/firebase/bookings";
import { useAuth } from "../../hooks/useAuth";
import type { CameraLocation, CameraSlot } from "../../types/cameraLocation";
import type { UserProfile } from "../../types/user";
import { Card } from "../common/Card";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";
import "./CameraLocationsSection.css";

/**
 * Camera check-in locations are assigned PER LOGIN: pick a counsellor or
 * head, then set their two slots — Location 1 and Location 2 — each with a
 * map-placed pin and radius. No free-form "add"; the two slots are fixed.
 */
export function CameraLocationsSection() {
  const { currentUser, profile } = useAuth();
  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [locations, setLocations] = useState<CameraLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<CameraSlot | null>(null);
  const [draft, setDraft] = useState({ name: "", description: "", radiusMeters: "50" });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = subscribeAllCameraLocations(setLocations);
    listBookableProfiles().then((profiles) => {
      setStaff(
        profiles.filter(
          (p) =>
            (p.role === "counsellor" || p.role === "head") &&
            !!p.campusId &&
            // A Head manages their own campus; Super Admin and Management
            // admins see all (or their scoped) campuses.
            (profile?.role === "super-admin" ||
              (profile?.role === "head" && p.campusId === profile.campusId)),
        ),
      );
      setLoading(false);
    });
    return () => unsub();
  }, [profile?.role, profile?.campusId]);

  const selected = useMemo(
    () => staff.find((p) => p.uid === selectedUid) ?? null,
    [selectedUid, staff],
  );
  const selectedLocations = useMemo(
    () => locations.filter((l) => l.uid === selectedUid),
    [locations, selectedUid],
  );
  const locationFor = (slot: CameraSlot) =>
    selectedLocations.find((l) => l.slot === slot) ?? null;

  function openSlotEditor(slot: CameraSlot) {
    const existing = locationFor(slot);
    setEditingSlot(slot);
    setDraft({
      name: existing?.name ?? "",
      description: existing?.description ?? "",
      radiusMeters: String(existing?.radiusMeters ?? 50),
    });
    setCoords(
      existing
        ? { lat: existing.latitude, lng: existing.longitude }
        : null,
    );
    setError("");
  }

  async function saveSlot() {
    if (!selected || !editingSlot || !currentUser || !profile) return;
    if (!coords || !draft.name.trim() || Number(draft.radiusMeters) <= 0) {
      setError("A name, a placed pin on the map and a positive radius are required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveCameraLocation({
        uid: selected.uid,
        slot: editingSlot,
        campusId: selected.campusId ?? "",
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        latitude: coords.lat,
        longitude: coords.lng,
        radiusMeters: Number(draft.radiusMeters),
        createdByUid: currentUser.uid,
        createdByName: profile.displayName || profile.email,
        createdByRole: profile.role,
      });
      setEditingSlot(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function clearSlot(slot: CameraSlot) {
    if (!selected) return;
    setBusy(true);
    try {
      await clearCameraSlot(selected.uid, slot);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  return (
    <div className="camera-locations">
      <div className="camera-locations__header">
        <div>
          <h3 className="camera-locations__heading">Camera Check-in Locations</h3>
          <p className="camera-locations__intro">
            Each counsellor and head has two fixed check-in spots — Location 1 and Location 2.
            Select a login below and set both spots. Their check-in and check-out are only
            accepted at one of these two, inside the radius.
          </p>
        </div>
      </div>

      {error && !editingSlot && <p className="camera-locations__error">{error}</p>}

      {!selected ? (
        staff.length === 0 ? (
          <p className="camera-locations__empty">No counsellors or heads found for your campus.</p>
        ) : (
          staff.map((person) => {
            const count = locations.filter((l) => l.uid === person.uid).length;
            return (
              <Card
                key={person.uid}
                className="camera-locations__row"
                onClick={() => setSelectedUid(person.uid)}
              >
                <div>
                  <p className="camera-locations__name">
                    {person.displayName || person.email}
                  </p>
                  <p className="camera-locations__meta">
                    {person.role === "head" ? "Head" : "Counsellor"}
                  </p>
                </div>
                <span className={`camera-locations__count${count === 2 ? " camera-locations__count--done" : ""}`}>
                  {count}/2 set
                </span>
              </Card>
            );
          })
        )
      ) : (
        <div className="camera-locations__detail">
          <div className="camera-locations__detail-header">
            <Button type="button" variant="outlined" onClick={() => { setSelectedUid(null); setEditingSlot(null); }}>
              ← All logins
            </Button>
            <span className="camera-locations__detail-name">
              {selected.displayName || selected.email}
            </span>
          </div>

          {(["location-1", "location-2"] as CameraSlot[]).map((slot) => {
            const loc = locationFor(slot);
            return (
              <Card key={slot} className="camera-locations__slot-card">
                <div className="camera-locations__slot-head">
                  <span className="camera-locations__slot-title">{slotLabel(slot)}</span>
                  {loc ? (
                    <div className="camera-locations__actions">
                      <Button type="button" variant="outlined" onClick={() => openSlotEditor(slot)}>
                        Edit Location
                      </Button>
                      <Button
                        type="button"
                        variant="outlined"
                        disabled={busy}
                        onClick={() => clearSlot(slot)}
                      >
                        Clear
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" onClick={() => openSlotEditor(slot)}>
                      Set Location
                    </Button>
                  )}
                </div>
                {loc ? (
                  <>
                    <p className="camera-locations__name">{loc.name}</p>
                    <p className="camera-locations__meta">
                      {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)} · {loc.radiusMeters}m range
                    </p>
                    {loc.description && (
                      <p className="camera-locations__desc">{loc.description}</p>
                    )}
                  </>
                ) : (
                  <p className="camera-locations__empty">Not set yet.</p>
                )}
              </Card>
            );
          })}

          {editingSlot && (
            <Modal
              title={`Editing ${slotLabel(editingSlot)}`}
              onClose={() => { setEditingSlot(null); setError(""); }}
            >
              <SlotEditor
                draft={draft}
                coords={coords}
                onDraft={(d) => setDraft((prev) => ({ ...prev, ...d }))}
                onCoords={setCoords}
                busy={busy}
                error={error}
                onSave={saveSlot}
                onCancel={() => { setEditingSlot(null); setError(""); }}
              />
            </Modal>
          )}
        </div>
      )}
    </div>
  );
}

// Inline sub-component for the slot editing form with the map picker.
import { LocationMapPicker } from "./LocationMapPicker";

function SlotEditor({
  draft,
  coords,
  onDraft,
  onCoords,
  busy,
  error,
  onSave,
  onCancel,
}: {
  draft: { name: string; description: string; radiusMeters: string };
  coords: { lat: number; lng: number } | null;
  onDraft: (d: Partial<{ name: string; description: string; radiusMeters: string }>) => void;
  onCoords: (c: { lat: number; lng: number } | null) => void;
  busy: boolean;
  error: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="camera-locations__form">
      <label>
        Location name
        <input
          type="text"
          value={draft.name}
          placeholder="e.g. Counselling Block Reception"
          onChange={(e) => onDraft({ name: e.target.value })}
        />
      </label>
      <label>
        Description (optional)
        <input
          type="text"
          value={draft.description}
          placeholder="e.g. Ground floor, near the stairs"
          onChange={(e) => onDraft({ description: e.target.value })}
        />
      </label>
      <div className="camera-locations__map-row">
        <LocationMapPicker
          latitude={coords?.lat ?? null}
          longitude={coords?.lng ?? null}
          radiusMeters={Number(draft.radiusMeters) || 50}
          onChange={(lat, lng) => onCoords({ lat, lng })}
        />
      </div>
      <div className="camera-locations__form-row">
        <label>
          Radius (meters)
          <input
            type="number"
            min="1"
            value={draft.radiusMeters}
            onChange={(e) => onDraft({ radiusMeters: e.target.value })}
          />
        </label>
      </div>
      <p className="camera-locations__coords">
        Pin at: {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : "—"}
      </p>
      {error && <p className="camera-locations__error">{error}</p>}
      <div className="camera-locations__form-actions">
        <Button type="button" onClick={onSave} disabled={busy}>
          {busy ? "Saving…" : "Save Location"}
        </Button>
        <Button type="button" variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
