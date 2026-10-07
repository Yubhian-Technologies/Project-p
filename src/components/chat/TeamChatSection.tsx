import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { sendTeamChatMessage, subscribeTeamChatMessages } from "../../services/firebase/teamChat";
import type { TeamChatMessage } from "../../types/teamChat";
import { Button } from "../common/Button";
import "./TeamChatSection.css";

// Space left below the chat on every screen, roughly matching the page's own
// bottom padding so the box doesn't butt right up against the edge.
const BOTTOM_MARGIN_PX = 24;

/** A single shared chat room per campus, for that campus's Head and every
    counsellor to coordinate in — not tied to any specific booking. */
export function TeamChatSection() {
  const { currentUser, profile } = useAuth();
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  const campusId = profile?.campusId;

  // Fill exactly to the bottom of the screen instead of guessing how tall
  // the header/sidebar chrome is above it (that guess drifted out of sync
  // and left a gap on some screens) — same "measure what's actually
  // rendered" approach Select.tsx uses to position its dropdown.
  useLayoutEffect(() => {
    function updateHeight() {
      if (!rootRef.current) return;
      const top = rootRef.current.getBoundingClientRect().top;
      const available = window.innerHeight - top - BOTTOM_MARGIN_PX;
      setHeight(Math.max(360, available));
    }
    updateHeight();
    window.addEventListener("resize", updateHeight);
    window.visualViewport?.addEventListener("resize", updateHeight);
    return () => {
      window.removeEventListener("resize", updateHeight);
      window.visualViewport?.removeEventListener("resize", updateHeight);
    };
  }, []);

  useEffect(() => {
    if (!campusId) return;
    const unsubscribe = subscribeTeamChatMessages(campusId, (list) => {
      setMessages(list);
      setError(null);
    });
    return () => unsubscribe();
  }, [campusId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!text.trim() || sending || !currentUser || !profile || !campusId) return;
    if (profile.role !== "counsellor" && profile.role !== "head") return;
    const msgText = text.trim();
    setText("");
    setSending(true);
    setError(null);
    try {
      await sendTeamChatMessage({
        campusId,
        senderUid: currentUser.uid,
        senderEmail: profile.email,
        senderName: profile.displayName || profile.email,
        senderRole: profile.role,
        text: msgText,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message. Please try again.");
      setText(msgText);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  }

  if (!campusId) {
    return <p style={{ color: "var(--neu-text-muted)", fontSize: 14 }}>Your profile isn't linked to a campus yet.</p>;
  }

  return (
    <div className="team-chat" ref={rootRef} style={height !== null ? { height } : undefined}>
      <div className="team-chat__messages">
        {messages.length === 0 ? (
          <p className="team-chat__empty">No messages yet. Say hello to your campus team!</p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderUid === currentUser?.uid;
            return (
              <div
                key={msg.id}
                className={`team-chat__bubble-wrap ${isMine ? "team-chat__bubble-wrap--mine" : "team-chat__bubble-wrap--them"}`}
              >
                <div className="team-chat__sender-info">
                  {isMine ? "You" : msg.senderName}
                  <span className={`team-chat__role-tag team-chat__role-tag--${msg.senderRole}`}>
                    {msg.senderRole}
                  </span>
                </div>
                <div className={`team-chat__bubble ${isMine ? "team-chat__bubble--mine" : "team-chat__bubble--them"}`}>
                  {msg.text}
                </div>
                <div className="team-chat__timestamp">
                  {new Date(msg.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="team-chat__input-row">
        {error && <p className="team-chat__error">{error}</p>}
        <input
          type="text"
          className="team-chat__input"
          placeholder="Message your campus team…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button type="button" disabled={!text.trim() || sending} onClick={handleSend}>
          {sending ? "Sending…" : "Send ➔"}
        </Button>
      </div>
    </div>
  );
}
