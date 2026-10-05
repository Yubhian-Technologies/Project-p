import { useEffect, useRef, useState } from "react";
import { hasLiked, toggleLike } from "../../../services/firebase/community";
import type { CommunityPost } from "../../../types/communityPost";
import { CommunityCommentThread } from "./CommunityCommentThread";

interface CommunityPostCardProps {
  post: CommunityPost;
  uid: string;
  isOwnPost: boolean;
  /** A Head moderating the community — can delete any post, not just their own. */
  canModerate?: boolean;
  myCommentIds: Set<string>;
  onDelete: () => void;
  onCommentsChanged: () => void;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function CommunityPostCard({
  post,
  uid,
  isOwnPost,
  canModerate,
  myCommentIds,
  onDelete,
  onCommentsChanged,
}: CommunityPostCardProps) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [expanded, setExpanded] = useState(false);
  const [likeAnim, setLikeAnim] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hasLiked(uid, post.id).then(setLiked);
  }, [uid, post.id]);

  useEffect(() => {
    setLikeCount(post.likeCount);
  }, [post.likeCount]);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  async function handleToggleLike() {
    const nowLiked = await toggleLike(uid, post.id);
    setLiked(nowLiked);
    setLikeCount((count) => (nowLiked ? count + 1 : Math.max(0, count - 1)));
    if (nowLiked) {
      setLikeAnim(true);
      setTimeout(() => setLikeAnim(false), 400);
    }
  }

  return (
    <article className="ig-card">
      {/* Pinned pushpin badge */}
      {post.pinned && (
        <div className="ig-card__pinned-badge" title="Pinned post" aria-label="Pinned post">
          <svg viewBox="0 0 24 24" fill="#C84B31" width="22" height="22">
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2z" />
          </svg>
        </div>
      )}

      {/* Header */}
      <div className="ig-card__header">
        <div className="ig-card__avatar">{post.authorName ? post.authorName.charAt(0).toUpperCase() : "A"}</div>
        <div className="ig-card__meta">
          <span className="ig-card__author">{post.authorName ?? "Anonymous"}</span>
          {post.authorName && post.authorEmail && (
            <span className="ig-card__author-email">{post.authorEmail}</span>
          )}
          <span className="ig-card__time">{timeAgo(post.createdAt)}</span>
        </div>

        {/* Three-dot menu — own posts, or any post for a Head moderating the community */}
        {(isOwnPost || canModerate) && (
          <div className="ig-card__menu-wrap" ref={menuRef}>
            <button
              type="button"
              className={`ig-card__more${menuOpen ? " ig-card__more--active" : ""}`}
              aria-label="Post options"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </button>

            {menuOpen && (
              <div className="ig-card__dropdown">
                <button
                  type="button"
                  className="ig-card__dropdown-item ig-card__dropdown-item--danger"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                  Delete post
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Post body */}
      <p className="ig-card__body">{post.text}</p>

      {/* Action buttons */}
      <div className="ig-card__actions">
        <button
          type="button"
          className={`ig-card__action-btn${liked ? " ig-card__action-btn--liked" : ""}`}
          onClick={handleToggleLike}
          aria-label={liked ? "Unlike" : "Like"}
        >
          <svg
            className={likeAnim ? "ig-card__heart--pop" : ""}
            viewBox="0 0 24 24"
            fill={liked ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span>{likeCount}</span>
        </button>

        <button
          type="button"
          className="ig-card__action-btn"
          onClick={() => setExpanded((e) => !e)}
          aria-label="Comments"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>{post.commentCount}</span>
        </button>
      </div>

      {/* Comment thread */}
      {expanded && (
        <CommunityCommentThread
          postId={post.id}
          uid={uid}
          myCommentIds={myCommentIds}
          onCommentsChanged={onCommentsChanged}
        />
      )}
    </article>
  );
}
