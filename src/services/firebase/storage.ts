import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./config";

export async function uploadAvatar(uid: string, file: File): Promise<string> {
  const avatarRef = ref(storage, `avatars/${uid}`);
  await uploadBytes(avatarRef, file);
  return getDownloadURL(avatarRef);
}

export async function uploadEventReport(eventId: string, uploaderUid: string, file: File): Promise<string> {
  const reportRef = ref(storage, `event-reports/${eventId}/${uploaderUid}/report`);
  await uploadBytes(reportRef, file);
  return getDownloadURL(reportRef);
}

export async function uploadEventPoster(eventId: string, uploaderUid: string, file: File): Promise<string> {
  const posterRef = ref(storage, `event-posters/${eventId}/${uploaderUid}/poster`);
  await uploadBytes(posterRef, file);
  return getDownloadURL(posterRef);
}

/** Private to the owner — only Head/Counsellor/Admin have a signature at all. */
export async function uploadSignatureImage(uid: string, file: File): Promise<string> {
  const signatureRef = ref(storage, `signatures/${uid}`);
  await uploadBytes(signatureRef, file);
  return getDownloadURL(signatureRef);
}
