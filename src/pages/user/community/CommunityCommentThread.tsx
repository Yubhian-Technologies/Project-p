import { useEffect, useState } from "react";
import { addComment, deleteComment, listCommentAuthors, listComments } from "../../../services/firebase/community";
import type { CommunityComment, CommunityPostAuthor } from "../../../types/communityPost";

interface CommunityCommentThreadProps {
  postId: string;
  uid: string;
  myCommentIds: Set<string>;
  showAuthors: boolean;
  onCommentsChanged: () => void;
}

export function CommunityCommentThread({ postId, uid, myCommentIds, showAuthors, onCommentsChanged }: CommunityCommentThreadProps) {
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [authors, setAuthors] = useState<Map<string, CommunityPostAuthor>>(new Map());
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  async function refresh() {
    const list = await listComments(postId);
    setComments(list);
    if (showAuthors) {
      try {
        setAuthors(await listCommentAuthors(postId, list.map((c) => c.id)));
      } catch (err) {
        console.error("Failed to load community comment authors", err);
        setAuthors(new Map());
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, [postId, showAuthors]);

  async function handlePost() {
    if (!text.trim()) return;
    setPosting(true);
    try {
      await addComment(uid, postId, text.trim());
      setText("");
      await refresh();
      onCommentsChanged();
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(commentId: string) {
    await deleteComment(uid, postId, commentId);
    await refresh();
    onCommentsChanged();
  }

  return (
    <div className="community-comment-thread">
      {loading ? (
        <p className="community-comment-thread__loading">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="community-comment-thread__empty">No comments yet. Be the first!</p>
      ) : (
        comments.map((comment) => {
          const author = authors.get(comment.id);
          return (
            <div key={comment.id} className="community-comment-thread__item">
              <span className="community-comment-thread__author">
                {author ? author.name : "Anonymous"}
              </span>
              {author && (
                <span className="community-comment-thread__author-email">{author.email}</span>
              )}
              <p className="community-comment-thread__text">{comment.text}</p>
              {myCommentIds.has(comment.id) && (
                <button
                  type="button"
                  className="community-comment-thread__delete"
                  onClick={() => handleDelete(comment.id)}
                >
                  Delete
                </button>
              )}
            </div>
          );
        })
      )}

      {/* Inline IG-style comment input */}
      <div className="community-comment-thread__composer">
        <textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handlePost();
            }
          }}
          placeholder="Add a comment…"
        />
        <button
          type="button"
          className="community-comment-thread__composer-send"
          disabled={!text.trim() || posting}
          onClick={handlePost}
        >
          {posting ? "…" : "Post"}
        </button>
      </div>
    </div>
  );
}
