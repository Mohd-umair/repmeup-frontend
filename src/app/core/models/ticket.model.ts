export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high';
export type TicketCategory = 'bug' | 'feature_request' | 'billing' | 'general';

export interface ITicketAttachment {
  url: string;
  name: string;
  type: string;
}

export interface ITicket {
  _id: string;
  organization: string;
  raisedBy: { _id: string; firstName?: string; lastName?: string; email?: string } | string;
  subject: string;
  category: TicketCategory;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  attachments: ITicketAttachment[];
  adminNotes?: string;
  resolvedAt?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ITicketPagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ITicketListResponse {
  tickets: ITicket[];
  pagination: ITicketPagination;
}

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed'
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High'
};

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  bug: 'Bug / Issue',
  feature_request: 'Feature Request',
  billing: 'Billing',
  general: 'General'
};
