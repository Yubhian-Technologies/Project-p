import { useEffect, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import {
  createCommunityPost,
  deleteCommunityPost,
  listCommunityPosts,
  listMyCommentIds,
  listMyPostIds,
} from "../../../services/firebase/community";
import type { CommunityPost } from "../../../types/communityPost";
import { CommunityPostCard } from "./CommunityPostCard";
import "./CommunitySection.css";

export function CommunitySection() {
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [myPostIds, setMyPostIds] = useState<Set<string>>(new Set());
  const [myCommentIds, setMyCommentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  async function refresh() {
    if (!currentUser) return;
    const [allPosts, ownPostIds, ownCommentIds] = await Promise.all([
      listCommunityPosts(),
      listMyPostIds(currentUser.uid),
      listMyCommentIds(currentUser.uid),
    ]);
    setPosts(allPosts);
    setMyPostIds(ownPostIds);
    setMyCommentIds(ownCommentIds);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, [currentUser]);

  async function handlePost() {
    if (!currentUser || !text.trim()) return;
    setPosting(true);
    try {
      await createCommunityPost(currentUser.uid, text.trim());
      setText("");
      setComposeOpen(false);
      await refresh();
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(postId: string) {
    if (!currentUser) return;
    await deleteCommunityPost(currentUser.uid, postId);
    await refresh();
  }

  if (loading) return null;

  return (
    <div className="community-section">
      {/* Header bar */}
      <div className="community-section__topbar">
        <span className="community-section__title">Wellness Community</span>
        <span className="community-section__subtitle">Anonymous · Safe · Supportive</span>
      </div>

      {/* Feed */}
      {posts.length === 0 ? (
        <div className="community-section__empty">
          <span className="community-section__empty-icon">🌱</span>
          <p>No posts yet — be the first to share something.</p>
        </div>
      ) : (
        <div className="community-section__feed">
          {posts.map((post) =>
            currentUser ? (
              <CommunityPostCard
                key={post.id}
                post={post}
                uid={currentUser.uid}
                isOwnPost={myPostIds.has(post.id)}
                myCommentIds={myCommentIds}
                onDelete={() => handleDelete(post.id)}
                onCommentsChanged={refresh}
              />
            ) : null,
          )}
        </div>
      )}

      {/* Instagram-style FAB */}
      <button
        type="button"
        className="community-section__fab"
        aria-label="Create new post"
        onClick={() => setComposeOpen(true)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Compose modal */}
      {composeOpen && (
        <div className="community-compose-overlay" onClick={() => setComposeOpen(false)}>
          <div className="community-compose-modal" onClick={(e) => e.stopPropagation()}>
            <div className="community-compose-modal__header">
              <button
                type="button"
                className="community-compose-modal__close"
                onClick={() => setComposeOpen(false)}
              >
                ✕
              </button>
              <span className="community-compose-modal__title">New Post</span>
              <button
                type="button"
                className="community-compose-modal__share"
                disabled={!text.trim() || posting}
                onClick={handlePost}
              >
                {posting ? "Sharing…" : "Share"}
              </button>
            </div>

            <div className="community-compose-modal__body">
              <div className="community-compose-modal__avatar">A</div>
              <div className="community-compose-modal__input-wrap">
                <p className="community-compose-modal__anon-label">Anonymous</p>
                <textarea
                  autoFocus
                  rows={5}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Share a thought or quote, anonymously…"
                  className="community-compose-modal__textarea"
                />
              </div>
            </div>

            <p className="community-compose-modal__note">
              🔒 Only "Anonymous" is shown — nobody can identify you.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
