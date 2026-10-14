import { useEffect, useState } from "react";
import { Button } from "../../components/common/Button";
import { useAuth } from "../../hooks/useAuth";
import {
  getFlashQAList,
  saveAllFlashQA,
  DEFAULT_FLASH_QA,
} from "../../services/firebase/flashQa";
import { listCampuses } from "../../services/firebase/campuses";
import type { Campus } from "../../types/campus";
import type { FlashQAItem } from "../../types/flashQa";
import "./FlashQASection.css";

// The student-facing card is a fixed 200px flip card, so text beyond roughly
// these limits would be clipped/scrolled instead of shown fully. The character
// cap also stops a long run of text with no spaces from slipping past the
// word cap.
const LIMITS = {
  question: { words: 20, chars: 130 },
  answer: { words: 30, chars: 220 },
} as const;

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function withinLimit(text: string, limit: { words: number; chars: number }): boolean {
  return text.length <= limit.chars && countWords(text) <= limit.words;
}

// Cuts text down to the limit without touching the whitespace the user typed.
function truncateToLimit(text: string, limit: { words: number; chars: number }): string {
  let end = text.length;
  let seen = 0;
  for (const match of text.matchAll(/\S+/g)) {
    seen += 1;
    if (seen > limit.words) {
      end = match.index ?? end;
      break;
    }
  }
  return text.slice(0, Math.min(end, limit.chars)).trimEnd();
}

export function FlashQASection() {
  const { profile } = useAuth();
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState<string>(profile?.campusId || "");
  const [items, setItems] = useState<FlashQAItem[]>(DEFAULT_FLASH_QA);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Load campuses list
  useEffect(() => {
    let active = true;
    listCampuses()
      .then((list) => {
        if (active) {
          setCampuses(list);
          if (!selectedCampusId && list.length > 0) {
            setSelectedCampusId(profile?.campusId || list[0].id);
          }
        }
      })
      .catch((err) => {
        console.error("Error loading campuses for Flash Q&A:", err);
      });
    return () => {
      active = false;
    };
  }, [profile?.campusId, selectedCampusId]);

  // Load flashcards for the selected campus
  useEffect(() => {
    let active = true;
    const campusToLoad = selectedCampusId || profile?.campusId;
    if (!campusToLoad) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadFailed(false);
    getFlashQAList(campusToLoad)
      .then((data) => {
        if (active) {
          setItems(data.length === 5 ? data : DEFAULT_FLASH_QA);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error loading Flash Q&A:", err);
        if (active) {
          setLoadFailed(true);
          const code =
            typeof err === "object" && err !== null && "code" in err
              ? String((err as { code: unknown }).code)
              : "";
          const detail = code
            ? ` Firestore rejected the read${code === "permission-denied" ? " (permission-denied — deploy the latest firestore.rules)" : code === "failed-precondition" ? " (failed-precondition — deploy firestore.indexes.json)" : ` (${code})`}.`
            : "";
          setStatusMessage({
            type: "error",
            text:
              `Could not load this campus's saved Flash Q&A cards.${detail} Nothing was overwritten. Click Retry once the Firestore issue is resolved.`,
          });
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [selectedCampusId, profile?.campusId, reloadKey]);

  const currentCampus = campuses.find((c) => c.id === (selectedCampusId || profile?.campusId));

  function handleFieldChange(
    index: number,
    field: "question" | "answer" | "category",
    value: string
  ) {
    setItems((prev) => {
      const next = [...prev];
      let limited = value;
      if (field === "question" || field === "answer") {
        const limit = LIMITS[field];
        const previous = prev[index][field] ?? "";
        if (!withinLimit(value, limit)) {
          // Existing text may already be over the limit (older cards) — let it
          // be edited down, but never let it grow further.
          limited = value.length <= previous.length ? value : truncateToLimit(value, limit);
        }
      }
      next[index] = { ...next[index], [field]: limited };
      return next;
    });
  }


  async function handleSaveAll() {
    const targetCampus = selectedCampusId || profile?.campusId;
    if (!targetCampus) {
      setStatusMessage({
        type: "error",
        text: "Please select a campus to save Flash Q&A cards for.",
      });
      return;
    }

    setSaving(true);
    setStatusMessage(null);
    try {
      await saveAllFlashQA(items, targetCampus);
      setStatusMessage({
        type: "success",
        text: `Flash Q&A cards updated for ${currentCampus?.name || "your campus"}! Only students from this campus will see these questions.`,
      });
    } catch (err: unknown) {
      console.error("Failed to save Flash Q&A cards:", err);
      setStatusMessage({
        type: "error",
        text: "Failed to save changes. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flash-qa-manage">
      <div className="flash-qa-manage__header">
        <div className="flash-qa-manage__title-group">
          <h2>Daily Flash Q/A Management</h2>
          <p>
            Write and curate the 5 mental wellness flashcards that appear on the student dashboard for{" "}
            <strong>{currentCampus ? currentCampus.name : "your campus"}</strong>.
          </p>
          {campuses.length > 1 && !profile?.campusId && (
            <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <label htmlFor="campus-select" style={{ fontSize: "13px", fontWeight: 600 }}>
                Select Campus:
              </label>
              <select
                id="campus-select"
                value={selectedCampusId}
                onChange={(e) => setSelectedCampusId(e.target.value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "12px",
                  border: "none",
                  background: "var(--neu-bg, #E8ECF2)",
                  boxShadow: "var(--neu-shadow-sunken-sm)",
                  color: "var(--neu-text-primary, #2D3748)",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flash-qa-manage__actions">
          <Button
            type="button"
            variant="outlined"
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={saving || loading}
          >
            Retry
          </Button>
          <Button
            type="button"
            variant="filled"
            onClick={handleSaveAll}
            disabled={saving || loading || loadFailed}
          >
            {saving ? "Saving..." : "Save All Changes"}
          </Button>
        </div>
      </div>

      {statusMessage && (
        <div className={`flash-qa-manage__alert flash-qa-manage__alert--${statusMessage.type}`}>
          {statusMessage.text}
        </div>
      )}

      {loading ? (
        <div className="flash-qa-manage">
          <p style={{ color: "var(--neu-text-muted)" }}>Loading campus Flash Q&A cards...</p>
        </div>
      ) : (
        <div className="flash-qa-manage__grid">
          {items.map((item, idx) => (
            <div key={item.id || idx} className="flash-qa-card-editor">
              <div className="flash-qa-card-editor__top">
                <span className="flash-qa-card-editor__badge">
                  Card #{idx + 1} of 5
                </span>
                {currentCampus && (
                  <span
                    style={{
                      fontSize: "12px",
                      color: "var(--neu-text-muted, #718096)",
                      fontWeight: 600,
                    }}
                  >
                    Campus: {currentCampus.name}
                  </span>
                )}
              </div>

              <div className="flash-qa-card-editor__field">
                <label htmlFor={`qa-cat-${idx}`}>Category / Tag</label>
                <input
                  id={`qa-cat-${idx}`}
                  type="text"
                  className="flash-qa-card-editor__input"
                  placeholder="e.g., Mindfulness, Anxiety, Sleep"
                  value={item.category || ""}
                  onChange={(e) => handleFieldChange(idx, "category", e.target.value)}
                />
              </div>

              <div className="flash-qa-card-editor__field">
                <label htmlFor={`qa-q-${idx}`}>
                  Question ({countWords(item.question)}/{LIMITS.question.words} words)
                </label>
                <input
                  id={`qa-q-${idx}`}
                  type="text"
                  className="flash-qa-card-editor__input"
                  placeholder="Enter the question..."
                  value={item.question}
                  onChange={(e) => handleFieldChange(idx, "question", e.target.value)}
                />
              </div>

              <div className="flash-qa-card-editor__field">
                <label htmlFor={`qa-a-${idx}`}>
                  Answer — revealed on flip ({countWords(item.answer)}/{LIMITS.answer.words} words)
                </label>
                <textarea
                  id={`qa-a-${idx}`}
                  className="flash-qa-card-editor__textarea"
                  placeholder="Enter the answer..."
                  value={item.answer}
                  onChange={(e) => handleFieldChange(idx, "answer", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
