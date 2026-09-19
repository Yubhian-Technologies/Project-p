export interface CommunityPost {
  id: string;
  text: string;
  likeCount: number;
  commentCount: number;
  createdAt: number;
  campusId: string;
  pinned?: boolean;
  authorName?: string;
  authorEmail?: string;
}

export interface CommunityFeedCursor {
  createdAt: number;
  id: string;
}

export interface CommunityComment {
  id: string;
  postId: string;
  text: string;
  createdAt: number;
  authorName?: string;
  authorEmail?: string;
}

export interface CommunityPostAuthor {
  id: string;
  name: string;
  email: string;
}
