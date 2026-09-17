import { useEffect, useRef, useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { sendChatMessage, subscribeChatMessages } from "../../services/firebase/chat";
import type { ChatMessage } from "../../types/chat";
import "./ChatModal.css";

interface ChatModalProps {
  chatRoomId: string;
  bookingId?: string;
  counterpartName: string;
  counterpartRole: "user" | "counsellor";
  currentUser: {
    uid: string;
    email: string;
    displayName?: string;
    role: "user" | "counsellor" | "head" | "admin" | "super-admin";
  };
  onClose: () => void;
}

export function ChatModal({
  chatRoomId,
  bookingId,
  counterpartName,
  counterpartRole,
  currentUser,
  onClose,
}: ChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeChatMessages(chatRoomId, (list) => {
      setMessages(list);
      setError(null);
    });
    return () => unsubscribe();
  }, [chatRoomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!text.trim() || sending) return;
    const msgText = text.trim();
    setText("");
    setSending(true);
    setError(null);
    try {
      await sendChatMessage({
        chatRoomId,
        bookingId,
        senderUid: currentUser.uid,
        senderEmail: currentUser.email,
        senderName: currentUser.displayName || currentUser.email,
        senderRole: currentUser.role,
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

  return (
    <Modal
      title={
        <div className="chat-modal__title-row">
          <span>Chat with {counterpartName}</span>
          <span className="chat-modal__role-tag">{counterpartRole}</span>
        </div>
      }
      onClose={onClose}
      className="chat-modal"
    >
      <div className="chat-modal__body">
        <div className="chat-modal__messages">
          {messages.length === 0 ? (
            <p className="chat-modal__empty">No messages yet. Send a message to start chatting!</p>
          ) : (
            messages.map((msg) => {
              const isMine = msg.senderUid === currentUser.uid;
              return (
                <div
                  key={msg.id}
                  className={`chat-modal__bubble-wrap ${isMine ? "chat-modal__bubble-wrap--mine" : "chat-modal__bubble-wrap--them"}`}
                >
                  <div className="chat-modal__sender-info">
                    {isMine ? "You" : msg.senderName}
                  </div>
                  <div className={`chat-modal__bubble ${isMine ? "chat-modal__bubble--mine" : "chat-modal__bubble--them"}`}>
                    {msg.text}
                  </div>
                  <div className="chat-modal__timestamp">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div className="chat-modal__input-row">
          {error && <p className="chat-modal__error">{error}</p>}
          <input
            type="text"
            className="chat-modal__input"
            placeholder="Type your message here…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button type="button" disabled={!text.trim() || sending} onClick={handleSend}>
            {sending ? "Sending…" : "Send ➔"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
