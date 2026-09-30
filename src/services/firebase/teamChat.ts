import { addDoc, collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./config";
import { listBookableProfiles } from "./bookings";
import { createNotification } from "./notifications";
import type { TeamChatMessage } from "../../types/teamChat";

const COLLECTION = "teamChatMessages";

export async function sendTeamChatMessage(params: {
  campusId: string;
  senderUid: string;
  senderEmail: string;
  senderName: string;
  senderRole: "counsellor" | "head";
  text: string;
}): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...params,
    createdAt: Date.now(),
  });

  // Every other Head/Counsellor on the same campus gets a heads-up — this is
  // a live shared room, but someone isn't necessarily sitting on the tab.
  const campusStaff = (await listBookableProfiles()).filter(
    (p) => p.campusId === params.campusId && p.uid !== params.senderUid,
  );
  const preview = params.text.length > 60 ? `${params.text.slice(0, 60)}…` : params.text;
  await Promise.all(
    campusStaff.map((member) =>
      createNotification({
        recipientId: member.uid,
        type: "team_chat_message",
        title: "New team chat message",
        message: `${params.senderName}: ${preview}`,
      }),
    ),
  );

  return docRef.id;
}

export function subscribeTeamChatMessages(
  campusId: string,
  callback: (messages: TeamChatMessage[]) => void,
): () => void {
  // No orderBy — a single equality filter only needs Firestore's automatic
  // single-field index, so this works immediately with no composite index to
  // wait on. Messages are sorted client-side by createdAt.
  const q = query(collection(db, COLLECTION), where("campusId", "==", campusId));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: TeamChatMessage[] = snapshot.docs
        .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<TeamChatMessage, "id">) }))
        .sort((a, b) => a.createdAt - b.createdAt);
      callback(list);
    },
    (error) => {
      console.error("Team chat subscription failed:", error);
    },
  );
}
