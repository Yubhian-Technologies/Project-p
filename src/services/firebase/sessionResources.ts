import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "./config";
import { createNotification } from "./notifications";
import type { SessionResource, SessionResourceType } from "../../types/sessionResource";

export interface ResourceAuthor {
  uid: string;
  name: string;
  role: string;
}

interface AddSessionResourceParams {
  bookingId: string;
  userId: string;
  counsellorId: string;
  campusId?: string;
  type: SessionResourceType;
  title: string;
  audioUrl?: string;
  fileName?: string;
  url?: string;
  addedBy: ResourceAuthor;
}

function mapResource(id: string, data: Record<string, unknown>): SessionResource {
  return { id, ...data } as unknown as SessionResource;
}

export function newSessionResourceId(): string {
  return doc(collection(db, "session_resources")).id;
}

export async function uploadSessionMusic(
  authorUid: string,
  bookingId: string,
  resourceId: string,
  file: File,
): Promise<string> {
  const fileRef = ref(storage, `session-resources/${authorUid}/${bookingId}/${resourceId}/track`);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

export async function saveSessionResource(
  resourceId: string,
  params: AddSessionResourceParams,
): Promise<void> {
  await setDoc(doc(db, "session_resources", resourceId), {
    ...params,
    createdAt: Date.now(),
  });

  // Tell the student a new resource just dropped in for their session — the
  // notification rules require the sender to be a party to the booking, so only
  // the session-holding counsellor/head triggers one, and it lands in-app.
  if (params.addedBy.uid !== params.userId && params.bookingId) {
    const isMusic = params.type === "music";
    await createNotification({
      recipientId: params.userId,
      type: "session_resource_added",
      bookingId: params.bookingId,
      title: params.type === "music" ? "New session music" : "New session link",
      message: `${params.addedBy.name} added "${params.title}" — ${isMusic ? "listen now" : "open it now"}.`,
    });
  }
}

export async function removeSessionResource(resourceId: string): Promise<void> {
  await deleteDoc(doc(db, "session_resources", resourceId));
}

export function subscribeSessionResources(
  bookingId: string,
  callback: (resources: SessionResource[]) => void,
): () => void {
  const q = query(collection(db, "session_resources"), where("bookingId", "==", bookingId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: SessionResource[] = snapshot.docs.map((d) => mapResource(d.id, d.data()));
      list.sort((a, b) => a.createdAt - b.createdAt);
      callback(list);
    },
    (error) => {
      console.error("Session resources subscription failed:", error);
    },
  );
}