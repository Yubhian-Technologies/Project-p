import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();

const auth = getAuth();
const db = getFirestore();

interface DeleteCampusLoginRequest {
  uid: string;
}

export const deleteCampusLogin = onCall<DeleteCampusLoginRequest>(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const callerDoc = await db.collection("users").doc(callerUid).get();
  if (callerDoc.data()?.role !== "super-admin") {
    throw new HttpsError("permission-denied", "Only a Super Admin can delete a campus login.");
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
  if (callerDoc.data()?.role !== "super-admin") {
    throw new HttpsError("permission-denied", "Only a Super Admin can create a campus login.");
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
  if (callerDoc.data()?.role !== "super-admin") {
    throw new HttpsError("permission-denied", "Only a Super Admin can edit a campus login.");
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
