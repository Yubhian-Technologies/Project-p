import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./config";

export async function uploadAvatar(uid: string, file: File): Promise<string> {
  const avatarRef = ref(storage, `avatars/${uid}`);
  await uploadBytes(avatarRef, file);
  return getDownloadURL(avatarRef);
}

export async function uploadEventReport(eventId: string, file: File): Promise<string> {
  const reportRef = ref(storage, `event-reports/${eventId}/report`);
  await uploadBytes(reportRef, file);
  return getDownloadURL(reportRef);
}
