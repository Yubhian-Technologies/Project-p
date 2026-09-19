import { useEffect, useState } from "react";
import { addComment, deleteComment, fetchCommentFeed } from "../../../services/firebase/community";
import type { CommunityComment, CommunityFeedCursor } from "../../../types/communityPost";

interface CommunityCommentThreadProps {
  postId: string;
  uid: string;
  myCommentIds: Set<string>;
  onCommentsChanged: () => void;
}

const COMMENT_PAGE_SIZE = 50;

export function CommunityCommentThread({ postId, uid, myCommentIds, onCommentsChanged }: CommunityCommentThreadProps) {
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<CommunityFeedCursor | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  async function refresh() {
    const page = await fetchCommentFeed(postId, null, COMMENT_PAGE_SIZE);
    setComments(page.comments);
    setHasMore(page.hasMore);
    setNextCursor(page.nextCursor);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, [postId]);

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchCommentFeed(postId, nextCursor, COMMENT_PAGE_SIZE);
      setComments((prev) => [...prev, ...page.comments]);
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

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
        <>
          {comments.map((comment) => (
            <div key={comment.id} className="community-comment-thread__item">
              <span className="community-comment-thread__author">
                {comment.authorName ?? "Anonymous"}
              </span>
              {comment.authorName && comment.authorEmail && (
                <span className="community-comment-thread__author-email">{comment.authorEmail}</span>
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
          ))}
          {hasMore && (
            <button
              type="button"
              className="community-comment-thread__load-more"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </>
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