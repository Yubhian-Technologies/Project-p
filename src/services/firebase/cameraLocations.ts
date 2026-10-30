import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./config";
import type { CameraLocation, CameraSlot } from "../../types/cameraLocation";
import { cameraDocId, CAMERA_SLOTS } from "./cameraSlots";

/**
 * Per-login camera locations. Each counsellor/head has exactly two slots
 * (location-1, location-2); doc id = {uid}_{slot} makes the cap structural —
 * a second write to the same slot overwrites, there is no third slot.
 */

// A stray/partial document (missing `uid` or `slot` — e.g. written before
// those fields were required, or edited by hand in the console) must not
// crash the sort for every other valid document: one bad doc previously
// threw inside the onSnapshot callback, which silently broke the *entire*
// live listener so no save — valid or not — ever reached the screen.
function isValidLocation(l: Partial<CameraLocation>): l is CameraLocation {
  return typeof l.uid === "string" && typeof l.slot === "string";
}

export async function listCameraLocations(): Promise<CameraLocation[]> {
  const snapshot = await getDocs(collection(db, "camera-locations"));
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }) as CameraLocation)
    .filter(isValidLocation)
    .sort((a, b) => a.uid.localeCompare(b.uid) || a.slot.localeCompare(b.slot));
}

/** The two slots for one login. */
export async function listLocationsForUser(uid: string): Promise<CameraLocation[]> {
  const snapshot = await getDocs(
    query(collection(db, "camera-locations"), where("uid", "==", uid)),
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as CameraLocation).filter(isValidLocation);
}

/** Real-time subscription for the management UI (all campuses). */
export function subscribeAllCameraLocations(
  callback: (locations: CameraLocation[]) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, "camera-locations"),
    (snapshot) => {
      callback(
        snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CameraLocation)
          .filter(isValidLocation)
          .sort((a, b) => a.uid.localeCompare(b.uid) || a.slot.localeCompare(b.slot)),
      );
    },
    (err) => {
      console.error("Failed to subscribe to camera locations", err);
      callback([]);
    },
  );
}

/** Real-time subscription for one person's two slots (the check-in card). */
export function subscribeLocationsForUser(
  uid: string,
  callback: (locations: CameraLocation[]) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "camera-locations"), where("uid", "==", uid)),
    (snapshot) => {
      callback(
        snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CameraLocation)
          .filter(isValidLocation)
          .sort((a, b) => a.slot.localeCompare(b.slot)),
      );
    },
    (err) => {
      console.error("Failed to subscribe to camera locations", err);
      callback([]);
    },
  );
}

/** Save (create or overwrite) one slot for a login. */
export async function saveCameraLocation(input: {
  uid: string;
  slot: CameraSlot;
  campusId: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  createdByUid: string;
  createdByName: string;
  createdByRole: string;
}): Promise<void> {
  const now = Date.now();
  // Firestore's web SDK rejects an explicit `undefined` field value (which
  // the optional `description` becomes when left blank) — build the payload
  // without the key at all rather than spreading it in as undefined.
  const { description, ...rest } = input;
  await setDoc(doc(db, "camera-locations", cameraDocId(input.uid, input.slot)), {
    ...rest,
    ...(description ? { description } : {}),
    createdAt: now,
    updatedAt: now,
  });
}

export async function clearCameraSlot(uid: string, slot: CameraSlot): Promise<void> {
  await deleteDoc(doc(db, "camera-locations", cameraDocId(uid, slot)));
}

/** Which slot is which, for display. */
export function slotLabel(slot: CameraSlot): string {
  return slot === "location-1" ? "Location 1" : "Location 2";
}

export { CAMERA_SLOTS, cameraDocId };
export function getCameraLocation(id: string) {
  return getDoc(doc(db, "camera-locations", id));
}
