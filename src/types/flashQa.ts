export interface FlashQAItem {
  id: string;
  campusId?: string;
  order: number;
  question: string;
  answer: string;
  category?: string;
  updatedAt?: number;
}
