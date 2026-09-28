export type SessionResourceType = "music" | "link";

export interface SessionResource {
  id: string;
  bookingId: string;
  userId: string;
  counsellorId: string;
  campusId?: string;
  type: SessionResourceType;
  title: string;
  /** Firebase Storage download URL for an uploaded music file. */
  audioUrl?: string;
  /** Original filename of an uploaded music file. */
  fileName?: string;
  /** External URL for link resources (Spotify, YouTube, web links). */
  url?: string;
  addedBy: {
    uid: string;
    name: string;
    role: string;
  };
  createdAt: number;
}