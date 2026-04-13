export interface IContactChannel {
  platform: string;
  platformUserId: string;
  username?: string;
  name?: string;
  avatarUrl?: string;
  profileUrl?: string;
  addedAt?: Date;
}

export interface IContactAIInsights {
  intent?: string | null;
  sentiment?: string | null;
  priority?: string | null;
  updatedAt?: Date | null;
}

export interface IContact {
  _id: string;
  organization: string;
  primaryName: string;
  primaryPhone?: string | null;
  primaryEmail?: string | null;
  channels: IContactChannel[];
  tags?: string[];
  notes?: string | null;
  aiInsights?: IContactAIInsights;
  lastInteractionAt?: Date | null;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt?: Date;
  /** Populated by GET /contacts/:id */
  interactions?: IContactInteractionPreview[];
}

export interface IContactInteractionPreview {
  _id: string;
  platform: string;
  type: string;
  content: string;
  status: string;
  platformCreatedAt: Date;
  respondedAt?: Date;
  chatRef?: string;
  chatNumber?: number;
}

export interface IContactListParams {
  search?: string;
  platform?: string;
  tag?: string;
  page?: number;
  limit?: number;
}
