export interface CommunityPost {
  id: string;
  text: string;
  likeCount: number;
  commentCount: number;
  createdAt: number;
  pinned?: boolean;
}

export interface CommunityComment {
  id: string;
  postId: string;
  text: string;
  createdAt: number;
}
