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
  const [guidelinesAgreed, setGuidelinesAgreed] = useState(false);
  const [guidelinesModalOpen, setGuidelinesModalOpen] = useState(false);

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

  function isGuidelinesAccepted(): boolean {
    if (!currentUser) return false;
    return localStorage.getItem(`community_guidelines_accepted:${currentUser.uid}`) === "true";
  }

  function handleOpenCompose() {
    if (!currentUser) return;
    if (!isGuidelinesAccepted()) {
      setGuidelinesModalOpen(true);
    } else {
      setGuidelinesAgreed(true);
      setComposeOpen(true);
    }
  }

  function handleAcceptGuidelines() {
    if (currentUser) {
      localStorage.setItem(`community_guidelines_accepted:${currentUser.uid}`, "true");
    }
    setGuidelinesAgreed(true);
    setGuidelinesModalOpen(false);
    setComposeOpen(true);
  }

  function handleCloseCompose() {
    setComposeOpen(false);
    setGuidelinesAgreed(false);
  }

  async function handlePost() {
    if (!currentUser || !text.trim() || !guidelinesAgreed) return;
    setPosting(true);
    try {
      await createCommunityPost(currentUser.uid, text.trim());
      setText("");
      setGuidelinesAgreed(false);
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
        onClick={handleOpenCompose}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Dedicated Guidelines Modal for First-time Posters */}
      {guidelinesModalOpen && (
        <div className="community-compose-overlay" onClick={() => setGuidelinesModalOpen(false)}>
          <div className="community-guidelines-modal" onClick={(e) => e.stopPropagation()}>
            <div className="community-guidelines-modal__header">
              <span className="community-guidelines-modal__title">VISHNU WELLNESS COMMUNITY GUIDELINES</span>
              <button
                type="button"
                className="community-compose-modal__close"
                onClick={() => setGuidelinesModalOpen(false)}
                aria-label="Close guidelines"
              >
                ✕
              </button>
            </div>

            <div className="community-guidelines-modal__body">
              <h3 className="community-guidelines-modal__subheading">Before You Share</h3>
              <p className="community-guidelines-modal__intro">Please help us keep this community safe and supportive:</p>

              <ul className="community-guidelines-modal__list">
                <li>
                  <span className="community-guidelines-modal__bullet">●</span> Be respectful and kind.
                </li>
                <li>
                  <span className="community-guidelines-modal__bullet">●</span> Protect privacy — don't share personal or identifying information about yourself or others.
                </li>
                <li>
                  <span className="community-guidelines-modal__bullet">●</span> No bullying, hate, harassment, threats, or harmful content.
                </li>
                <li>
                  <span className="community-guidelines-modal__bullet">●</span> You may share difficult feelings, but do not post graphic details or instructions about self-harm or suicide.
                </li>
                <li>
                  <span className="community-guidelines-modal__bullet">●</span> Support, don't judge. This is a space to listen and connect, not diagnose or prescribe.
                </li>
                <li>
                  <span className="community-guidelines-modal__bullet">●</span> Posts may be moderated or removed if they violate these guidelines or raise safety concerns.
                </li>
                <li className="community-guidelines-modal__item--alert">
                  <span className="community-guidelines-modal__bullet">●</span> This community is not an emergency or counselling service. If you are in immediate danger, seek immediate professional help.
                </li>
              </ul>

              <button
                type="button"
                className="community-compose-modal__share-btn"
                onClick={handleAcceptGuidelines}
              >
                I Accept & Agree
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compose modal */}
      {composeOpen && (
        <div className="community-compose-overlay" onClick={handleCloseCompose}>
          <div className="community-compose-modal" onClick={(e) => e.stopPropagation()}>
            <div className="community-compose-modal__header">
              <button
                type="button"
                className="community-compose-modal__close"
                onClick={handleCloseCompose}
                aria-label="Close modal"
              >
                ✕
              </button>
              <span className="community-compose-modal__title">New Post</span>
              <div className="community-compose-modal__header-spacer" />
            </div>

            <div className="community-compose-modal__body">
              {/* User Identity Top Row */}
              <div className="community-compose-modal__user-row">
                <div className="community-compose-modal__avatar">A</div>
                <div className="community-compose-modal__user-info">
                  <span className="community-compose-modal__anon-label">Anonymous</span>
                  <span className="community-compose-modal__anon-sub">Posting as Anonymous</span>
                </div>
              </div>

              {/* Full Width Textarea */}
              <textarea
                autoFocus
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Share a thought or quote, anonymously…"
                className="community-compose-modal__textarea"
              />

              {/* Guidelines & Terms Checkbox */}
              <div className="community-compose-modal__guidelines">
                <span className="community-compose-modal__guidelines-heading">Before posting</span>
                <p className="community-compose-modal__guidelines-quote">
                  “Is it respectful? Is it safe? Is it helpful?”
                </p>
                <label className="community-compose-modal__checkbox-label">
                  <input
                    type="checkbox"
                    checked={guidelinesAgreed}
                    onChange={(e) => setGuidelinesAgreed(e.target.checked)}
                    className="community-compose-modal__checkbox"
                  />
                  <span>
                    I agree to follow the{" "}
                    <button
                      type="button"
                      className="community-compose-modal__guidelines-link"
                      onClick={() => setGuidelinesModalOpen(true)}
                    >
                      Wellness Community Guidelines
                    </button>
                    .
                  </span>
                </label>
              </div>

              {/* Main Action Button */}
              <button
                type="button"
                className="community-compose-modal__share-btn"
                disabled={!text.trim() || !guidelinesAgreed || posting}
                onClick={handlePost}
              >
                {posting ? "Sharing Anonymously…" : "Share Anonymously"}
              </button>

              {/* Technical Anonymity Disclaimer Note */}
              <p className="community-compose-modal__disclaimer">
                <strong>Note:</strong> “Anonymous” means your name may not be displayed to other community
                members; it should not be understood as a guarantee of complete technical anonymity.
                This distinction is particularly important when collecting or processing digital personal data.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
