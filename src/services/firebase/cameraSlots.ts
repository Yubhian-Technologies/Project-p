import type { CameraSlot } from "../../types/cameraLocation";

export const CAMERA_SLOTS: CameraSlot[] = ["location-1", "location-2"];

export function cameraDocId(uid: string, slot: CameraSlot): string {
  return `${uid}_${slot}`;
}
