import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./config";
import type { FlashQAItem } from "../../types/flashQa";

export const DEFAULT_FLASH_QA: FlashQAItem[] = [
  {
    id: "qa-1",
    order: 1,
    question: "What is the 5-4-3-2-1 grounding technique?",
    answer:
      "A quick sensory reset for anxiety: identify 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, and 1 you can taste to bring your focus back to the present.",
    category: "Mindfulness",
  },
  {
    id: "qa-2",
    order: 2,
    question: "How does Box Breathing calm your nervous system?",
    answer:
      "Inhale for 4 seconds, hold for 4, exhale for 4, and hold for 4. This activates the vagus nerve and triggers the parasympathetic response, reducing acute stress rapidly.",
    category: "Anxiety Relief",
  },
  {
    id: "qa-3",
    order: 3,
    question: "What is cognitive reframing?",
    answer:
      "A psychological practice of identifying negative or unhelpful automatic thoughts and intentionally viewing them from a more balanced, compassionate, and realistic perspective.",
    category: "Cognitive Health",
  },
  {
    id: "qa-4",
    order: 4,
    question: "What is the key difference between stress and burnout?",
    answer:
      "Stress is characterized by over-engagement and urgency (feeling like you have too much). Burnout is characterized by chronic emotional depletion, detachment, and feeling like you have nothing left to give.",
    category: "Emotional Wellbeing",
  },
  {
    id: "qa-5",
    order: 5,
    question: "Why is quality sleep crucial for emotional regulation?",
    answer:
      "During deep and REM sleep, the brain recalibrates neurotransmitters and processes emotional memories. Poor sleep hyper-sensitizes the amygdala, amplifying emotional reactivity by up to 60%.",
    category: "Physical & Mental Balance",
  },
];

const flashQACollection = collection(db, "flash_qa");

function flashQADocId(campusId: string, order: number): string {
  // Firestore document IDs cannot contain '/' and a few other characters, so
  // drop anything unsafe before embedding a campus id into the document path.
  const safeCampusId = campusId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${safeCampusId}_qa_${order}`;
}

function isMissingIndexError(err: unknown): boolean {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = String((err as { code: unknown }).code);
    return code === "failed-precondition" || code === "resource-exhausted";
  }
  return false;
}

function mapFlashQAData(
  id: string,
  campusId: string,
  data: Record<string, unknown>
): FlashQAItem {
  return {
    id,
    campusId: data.campusId ? String(data.campusId) : campusId,
    order: Number(data.order ?? 1),
    question: String(data.question ?? ""),
    answer: String(data.answer ?? ""),
    category: data.category ? String(data.category) : undefined,
    updatedAt: data.updatedAt ? Number(data.updatedAt) : undefined,
  } as FlashQAItem;
}

export async function getFlashQAList(campusId?: string): Promise<FlashQAItem[]> {
  if (!campusId) {
    return DEFAULT_FLASH_QA;
  }

  let items: FlashQAItem[];
  try {
    const q = query(flashQACollection, where("campusId", "==", campusId));
    const snapshot = await getDocs(q);
    items = snapshot.docs.map((docSnap) => mapFlashQAData(docSnap.id, campusId, docSnap.data()));
  } catch (err) {
    if (!isMissingIndexError(err)) {
      throw err;
    }
    // The campusId query needs a Firestore index that isn't available yet.
    // Flash Q&A cards are always saved under deterministic document ids
    // ({campusId}_qa_{order}), so read them directly — document reads don't
    // require any index.
    const orderRefs = [1, 2, 3, 4, 5].map((order) =>
      doc(db, "flash_qa", flashQADocId(campusId, order))
    );
    const results = await Promise.all(orderRefs.map((ref) => getDoc(ref)));
    items = results
      .filter((d) => d.exists())
      .map((d) => mapFlashQAData(d.id, campusId, d.data()));
  }

  if (items.length === 0) {
    return DEFAULT_FLASH_QA;
  }

  items.sort((a, b) => a.order - b.order);
  return items;
}

function flashQAPayload(item: FlashQAItem, campusId: string) {
  return {
    campusId,
    order: item.order,
    question: item.question,
    answer: item.answer,
    category: item.category || "General",
    updatedAt: Date.now(),
  };
}

export async function saveFlashQAItem(item: FlashQAItem, campusId?: string): Promise<void> {
  const targetCampus = campusId || item.campusId;
  if (!targetCampus) {
    throw new Error("A campus is required to save Flash Q&A cards.");
  }
  const docRef = doc(db, "flash_qa", flashQADocId(targetCampus, item.order));
  await setDoc(docRef, flashQAPayload(item, targetCampus), { merge: true });
}

export async function saveAllFlashQA(items: FlashQAItem[], campusId?: string): Promise<void> {
  const targetCampus = campusId || items[0]?.campusId;
  if (!targetCampus) {
    throw new Error("A campus is required to save Flash Q&A cards.");
  }
  const batch = writeBatch(db);

  for (const item of items) {
    const docRef = doc(db, "flash_qa", flashQADocId(targetCampus, item.order));
    batch.set(docRef, flashQAPayload(item, targetCampus), { merge: true });
  }

  await batch.commit();
}
