export interface FaqItem {
  id: string;
  question: string;
  /** Plain text; line breaks preserved in template */
  answer: string;
}

export interface FaqCategory {
  id: string;
  title: string;
  icon: string;
  items: FaqItem[];
}
