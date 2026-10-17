import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

initializeApp();
const db = getFirestore();

const safeProfile = (id: string, data: FirebaseFirestore.DocumentData) => ({
  id,
  name: String(data.name ?? ""),
  nickname: String(data.nickname ?? ""),
  avatar: String(data.avatar ?? ""),
  bio: String(data.bio ?? ""),
  status: data.status === "online" ? "online" : "offline",
  lastSeen: String(data.lastSeen ?? ""),
  badge: String(data.badge ?? ""),
});

async function enforceSearchLimit(uid: string) {
  const ref = db.collection("searchRateLimits").doc(uid);
  const now = Timestamp.now();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const start = snap.get("windowStart") as Timestamp | undefined;
    const count = Number(snap.get("count") ?? 0);
    const active = start && now.toMillis() - start.toMillis() < 60_000;
    if (active && count >= 12) {
      throw new HttpsError("resource-exhausted", "Слишком много поисковых запросов. Попробуйте через минуту.");
    }
    tx.set(ref, {
      windowStart: active ? start : now,
      count: active ? count + 1 : 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

export const searchUserByEmail = onCall(
  { region: "us-central1" },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Войдите, чтобы искать пользователей.");
    const email = typeof request.data?.email === "string"
      ? request.data.email.trim().toLowerCase()
      : "";
    if (email.length < 5 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpsError("invalid-argument", "Введите полный корректный email.");
    }

    await enforceSearchLimit(uid);
    const match = await db.collection("users").where("email", "==", email).limit(1).get();
    if (match.empty || match.docs[0].id === uid) return { user: null };
    const doc = match.docs[0];
    return { user: safeProfile(doc.id, doc.data()) };
  }
);

export const sendFriendRequest = onCall(
  { region: "us-central1", enforceAppCheck: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Войдите, чтобы добавить друга.");
    const toUserId = typeof request.data?.toUserId === "string" ? request.data.toUserId : "";
    if (!toUserId || toUserId === uid) throw new HttpsError("invalid-argument", "Нельзя отправить заявку самому себе.");

    const fromRef = db.collection("publicProfiles").doc(uid);
    const toRef = db.collection("publicProfiles").doc(toUserId);
    const requestRef = db.collection("friendRequests").doc(uid + "_" + toUserId);
    const [fromSnap, toSnap] = await Promise.all([fromRef.get(), toRef.get()]);
    if (!fromSnap.exists || !toSnap.exists) throw new HttpsError("not-found", "Профиль пользователя не найден.");

    const result = await db.runTransaction(async (tx) => {
      const existing = await tx.get(requestRef);
      const reverseRef = db.collection("friendRequests").doc(toUserId + "_" + uid);
      const reverse = await tx.get(reverseRef);
      if (existing.exists && existing.get("status") === "accepted") return "accepted";
      if (existing.exists && existing.get("status") === "pending") return "pending";
      if (reverse.exists && reverse.get("status") === "pending") return "incoming";
      if (reverse.exists && reverse.get("status") === "accepted") return "accepted";
      tx.set(requestRef, {
        fromUserId: uid,
        toUserId,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return "pending";
    });
    return { status: result, user: safeProfile(toUserId, toSnap.data()!) };
  }
);

export const respondToFriendRequest = onCall(
  { region: "us-central1", enforceAppCheck: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Войдите, чтобы обработать заявку.");
    const requestId = typeof request.data?.requestId === "string" ? request.data.requestId : "";
    const action = request.data?.action;
    if (!requestId || (action !== "accept" && action !== "decline")) {
      throw new HttpsError("invalid-argument", "Некорректное действие.");
    }
    const ref = db.collection("friendRequests").doc(requestId);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError("not-found", "Заявка не найдена.");
      if (snap.get("toUserId") !== uid) throw new HttpsError("permission-denied", "Обработать заявку может только получатель.");
      if (snap.get("status") !== "pending") throw new HttpsError("failed-precondition", "Заявка уже обработана.");
      tx.update(ref, { status: action === "accept" ? "accepted" : "declined", updatedAt: FieldValue.serverTimestamp() });
    });
    return { success: true };
  }
);
