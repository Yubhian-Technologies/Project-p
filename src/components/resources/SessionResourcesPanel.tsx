import { useEffect, useRef, useState } from "react";
import type { SessionResource } from "../../types/sessionResource";
import { useDynamicIsland } from "../../context/DynamicIslandContext";
import {
  newSessionResourceId,
  removeSessionResource,
  saveSessionResource,
  subscribeSessionResources,
  uploadSessionMusic,
  type ResourceAuthor,
} from "../../services/firebase/sessionResources";
import { Button } from "../common/Button";
import "./SessionResourcesPanel.css";

interface SessionResourcesPanelProps {
  bookingId: string;
  userId: string;
  counsellorId: string;
  campusId?: string;
  canManage: boolean;
  author: ResourceAuthor | null;
}

function youtubeEmbedUrl(url: string): string | null {
  let id = "";
  const u = new URL(url);
  if (u.hostname === "youtu.be") {
    id = u.pathname.slice(1);
  } else if (u.hostname.includes("youtube.com")) {
    id = u.searchParams.get("v") ?? "";
  }
  if (!id) return null;
  return `https://www.youtube-nocookie.com/embed/${id}`;
}

function spotifyEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("open.spotify.com")) return null;
    const m = u.pathname.match(/^\/(track|album|playlist|artist)\/([^/]+)/);
    if (!m) return null;
    return `https://open.spotify.com/embed/${m[1]}/${m[2]}`;
  } catch {
    return null;
  }
}

export function SessionResourcesPanel({
  bookingId,
  userId,
  counsellorId,
  campusId,
  canManage,
  author,
}: SessionResourcesPanelProps) {
  const [resources, setResources] = useState<SessionResource[]>([]);
  const [addMode, setAddMode] = useState<"music" | "link" | null>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { nowPlaying, isPlaying, playMusic, togglePlayback, showAlert } = useDynamicIsland();
  const knownIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeSessionResources(bookingId, (list) => {
      // Only alert for resources added after the first load — otherwise the
      // initial fetch itself would fire an alert for every existing one.
      if (knownIds.current !== null) {
        const added = list.find((r) => !knownIds.current!.has(r.id));
        if (added) {
          showAlert(`New ${added.type === "music" ? "music" : "link"} resource: ${added.title}`);
        }
      }
      knownIds.current = new Set(list.map((r) => r.id));
      setResources(list);
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  function resetForm() {
    setAddMode(null);
    setTitle("");
    setFile(null);
    setLinkUrl("");
    setError(null);
  }

  async function handleAddMusic() {
    if (!title.trim() || !file || !author) return;
    setSaving(true);
    setError(null);
    try {
      const resourceId = newSessionResourceId();
      const audioUrl = await uploadSessionMusic(author.uid, bookingId, resourceId, file);
      await saveSessionResource(resourceId, {
        bookingId,
        userId,
        counsellorId,
        campusId,
        type: "music",
        title: title.trim(),
        audioUrl,
        fileName: file.name,
        addedBy: { uid: author.uid, name: author.name, role: author.role },
      });
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload the music file.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddLink() {
    if (!title.trim() || !author) return;
    let parsed: URL;
    try {
      parsed = new URL(linkUrl);
    } catch {
      setError("Please paste a valid link (starting with https://).");
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      setError("Please paste a valid link (starting with https://).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const resourceId = newSessionResourceId();
      await saveSessionResource(resourceId, {
        bookingId,
        userId,
        counsellorId,
        campusId,
        type: "link",
        title: title.trim(),
        url: linkUrl.trim(),
        addedBy: { uid: author.uid, name: author.name, role: author.role },
      });
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add the link.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    setError(null);
    try {
      await removeSessionResource(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove the resource.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="sr-panel">
      <div className="sr-panel__header">
        <div>
          <span className="sr-panel__subtitle">SESSION RESOURCES</span>
          <h4 className="sr-panel__title">Music & links for this session</h4>
        </div>
        {canManage && !addMode && (
          <Button type="button" variant="outlined" onClick={() => setAddMode("music")}>
            + Add Music / Link
          </Button>
        )}
      </div>

      {canManage && addMode && (
        <div className="sr-panel__form">
          <div className="sr-panel__form-tabs">
            <button
              type="button"
              className={`sr-panel__tab${addMode === "music" ? " sr-panel__tab--active" : ""}`}
              onClick={() => {
                setAddMode("music");
                setError(null);
              }}
            >
              Music file
            </button>
            <button
              type="button"
              className={`sr-panel__tab${addMode === "link" ? " sr-panel__tab--active" : ""}`}
              onClick={() => {
                setAddMode("link");
                setError(null);
              }}
            >
              Link (Spotify / YouTube / web)
            </button>
          </div>

          <label className="sr-panel__label" htmlFor="sr-title">Title</label>
          <input
            id="sr-title"
            className="sr-panel__input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Calming meditation track"
          />

          {addMode === "music" ? (
            <label className="sr-panel__label" htmlFor="sr-file">Audio file (MP3 recommended)</label>
          ) : (
            <label className="sr-panel__label" htmlFor="sr-url">Link URL</label>
          )}

          {addMode === "music" ? (
            <input
              id="sr-file"
              className="sr-panel__input"
              type="file"
              accept="audio/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          ) : (
            <input
              id="sr-url"
              className="sr-panel__input"
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://open.spotify.com/track/…"
            />
          )}

          {error && <p className="sr-panel__error">{error}</p>}

          <div className="sr-panel__form-actions">
            <Button type="button" disabled={saving || !title.trim()} onClick={addMode === "music" ? handleAddMusic : handleAddLink}>
              {saving ? "Saving…" : addMode === "music" ? "Add music" : "Add link"}
            </Button>
            <Button type="button" variant="outlined" disabled={saving} onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {canManage && addMode && (
        <p className="sr-panel__hint">The student sees this instantly while the session is open.</p>
      )}

      {resources.length === 0 ? (
        <p className="sr-panel__empty">
          {canManage ? "No music or links added yet." : "Your counsellor hasn't added any session resources yet."}
        </p>
      ) : (
        <ul className="sr-panel__list">
          {resources.map((resource) => {
            const youtube = resource.url ? youtubeEmbedUrl(resource.url) : null;
            const spotify = resource.url ? spotifyEmbedUrl(resource.url) : null;
            return (
              <li key={resource.id} className="sr-panel__item">
                <div className="sr-panel__item-top">
                  <span className="sr-panel__item-title">{resource.title}</span>
                  <span className={`sr-panel__type-tag sr-panel__type-tag--${resource.type}`}>
                    {resource.type === "music" ? "Music" : "Link"}
                  </span>
                </div>

                {resource.type === "music" && resource.audioUrl && (
                  <button
                    type="button"
                    className="sr-panel__play-btn"
                    onClick={() => {
                      if (nowPlaying?.id === resource.id) {
                        togglePlayback();
                      } else {
                        playMusic({ id: resource.id, title: resource.title, audioUrl: resource.audioUrl! });
                      }
                    }}
                  >
                    {nowPlaying?.id === resource.id && isPlaying ? "⏸ Pause" : "▶ Play"}
                  </button>
                )}

                {resource.type === "link" && resource.url && (youtube || spotify) && (
                  <div className="sr-panel__embed">
                    <iframe
                      src={youtube || spotify || ""}
                      title={resource.title}
                      loading="lazy"
                      allow="encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}

                {resource.type === "link" && resource.url && !youtube && !spotify && (
                  <a
                    className="sr-panel__open-btn"
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open link ↗
                  </a>
                )}

                <div className="sr-panel__item-meta">
                  <span>Added by {resource.addedBy.name || resource.addedBy.role}</span>
                  <span>{new Date(resource.createdAt).toLocaleString()}</span>
                  {canManage && (
                    <button
                      type="button"
                      className="sr-panel__remove"
                      disabled={removingId === resource.id}
                      onClick={() => handleRemove(resource.id)}
                    >
                      {removingId === resource.id ? "Removing…" : "Remove"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}