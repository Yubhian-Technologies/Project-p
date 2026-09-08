import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { sendWhatsAppMessage } from "./whatsapp";

initializeApp();

const auth = getAuth();
const db = getFirestore();

const whatsappAccessToken = defineSecret("WHATSAPP_ACCESS_TOKEN");
const whatsappPhoneNumberId = defineSecret("WHATSAPP_PHONE_NUMBER_ID");

function isCampusManagerRole(role: unknown): boolean {
  return role === "admin" || role === "super-admin";
}

interface DeleteCampusLoginRequest {
  uid: string;
}

export const deleteCampusLogin = onCall<DeleteCampusLoginRequest>(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const callerDoc = await db.collection("users").doc(callerUid).get();
  if (!isCampusManagerRole(callerDoc.data()?.role)) {
    throw new HttpsError("permission-denied", "Only an Admin or Super Admin can delete a campus login.");
  }

  const targetUid = request.data.uid;
  if (!targetUid || typeof targetUid !== "string") {
    throw new HttpsError("invalid-argument", "A target uid is required.");
  }

  await auth.deleteUser(targetUid);
  await db.collection("users").doc(targetUid).delete();

  return { success: true };
});

interface CreateCampusLoginRequest {
  email: string;
  password: string;
  displayName: string;
  role: "counsellor" | "head";
  campusId: string;
  collegeId: string;
}

export const createCampusLogin = onCall<CreateCampusLoginRequest>(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const callerDoc = await db.collection("users").doc(callerUid).get();
  if (!isCampusManagerRole(callerDoc.data()?.role)) {
    throw new HttpsError("permission-denied", "Only an Admin or Super Admin can create a campus login.");
  }

  const { email, password, displayName, role, campusId, collegeId } = request.data;
  if (!email || !password || !displayName || !campusId || !collegeId) {
    throw new HttpsError("invalid-argument", "Email, password, display name, campus, and college are required.");
  }
  if (role !== "counsellor" && role !== "head") {
    throw new HttpsError("invalid-argument", "Role must be counsellor or head.");
  }

  if (role === "head") {
    const headSnapshot = await db
      .collection("users")
      .where("campusId", "==", campusId)
      .where("role", "==", "head")
      .get();
    if (!headSnapshot.empty) {
      throw new HttpsError("already-exists", "This campus already has a Head.");
    }
  }

  const userRecord = await auth.createUser({ email, password, displayName });
  try {
    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName,
      role,
      campusId,
      collegeId,
      createdAt: Date.now(),
    });
  } catch (err) {
    await auth.deleteUser(userRecord.uid);
    throw err;
  }

  return { success: true, uid: userRecord.uid };
});

interface UpdateCampusLoginRequest {
  uid: string;
  displayName: string;
  email: string;
  password?: string;
  role: "counsellor" | "head";
  collegeId: string;
}

export const updateCampusLogin = onCall<UpdateCampusLoginRequest>(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const callerDoc = await db.collection("users").doc(callerUid).get();
  if (!isCampusManagerRole(callerDoc.data()?.role)) {
    throw new HttpsError("permission-denied", "Only an Admin or Super Admin can edit a campus login.");
  }

  const { uid, displayName, email, password, role, collegeId } = request.data;
  if (!uid || typeof uid !== "string") {
    throw new HttpsError("invalid-argument", "A target uid is required.");
  }

  const targetDoc = await db.collection("users").doc(uid).get();
  const campusId = targetDoc.data()?.campusId;

  if (role === "head" && campusId) {
    const headSnapshot = await db
      .collection("users")
      .where("campusId", "==", campusId)
      .where("role", "==", "head")
      .get();
    const hasOtherHead = headSnapshot.docs.some((d) => d.id !== uid);
    if (hasOtherHead) {
      throw new HttpsError("already-exists", "This campus already has a Head.");
    }
  }

  await auth.updateUser(uid, {
    email,
    displayName,
    ...(password ? { password } : {}),
  });

  await db.collection("users").doc(uid).update({ displayName, email, role, collegeId });

  return { success: true };
});

// Fires whenever the client writes a new notification doc (createNotification() in
// src/services/firebase/notifications.ts) — mirrors every in-app notification to WhatsApp.
export const onNotificationCreated = onDocumentCreated(
  { document: "notifications/{notificationId}", secrets: [whatsappAccessToken, whatsappPhoneNumberId] },
  async (event) => {
    const notification = event.data?.data();
    if (!notification) return;

    const recipientDoc = await db.collection("users").doc(notification.recipientId).get();
    const recipient = recipientDoc.data();
    if (!recipient?.whatsappNumber) return;

    await sendWhatsAppMessage(
      whatsappAccessToken.value(),
      whatsappPhoneNumberId.value(),
      recipient.whatsappNumber,
      "session_update",
      [recipient.displayName || "there", notification.message],
    );
  },
);

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function todayRangeInIst(): { start: number; end: number } {
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);
  const startOfDayIstMidnightUtc = Date.UTC(
    nowIst.getUTCFullYear(),
    nowIst.getUTCMonth(),
    nowIst.getUTCDate(),
    0,
    0,
    0,
  );
  const start = startOfDayIstMidnightUtc - IST_OFFSET_MS;
  return { start, end: start + 24 * 60 * 60 * 1000 };
}

// Runs daily and WhatsApps both parties on every booking scheduled for later today.
export const sendSessionReminders = onSchedule(
  { schedule: "0 8 * * *", timeZone: "Asia/Kolkata", secrets: [whatsappAccessToken, whatsappPhoneNumberId] },
  async () => {
    const { start, end } = todayRangeInIst();
    const snapshot = await db
      .collection("bookings")
      .where("status", "==", "scheduled")
      .where("scheduledAt", ">=", start)
      .where("scheduledAt", "<", end)
      .get();

    const accessToken = whatsappAccessToken.value();
    const phoneNumberId = whatsappPhoneNumberId.value();

    for (const doc of snapshot.docs) {
      const booking = doc.data();
      const timeLabel = new Date(booking.scheduledAt).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
      });

      const [userDoc, counsellorDoc] = await Promise.all([
        db.collection("users").doc(booking.userId).get(),
        db.collection("users").doc(booking.counsellorId).get(),
      ]);

      const user = userDoc.data();
      const counsellor = counsellorDoc.data();

      if (user?.whatsappNumber) {
        await sendWhatsAppMessage(accessToken, phoneNumberId, user.whatsappNumber, "session_reminder", [
          user.displayName || "there",
          timeLabel,
        ]);
      }
      if (counsellor?.whatsappNumber) {
        await sendWhatsAppMessage(accessToken, phoneNumberId, counsellor.whatsappNumber, "session_reminder", [
          counsellor.displayName || "there",
          timeLabel,
        ]);
      }
    }
  },
);
