/**
 * WhatsApp Form Flow Data Models
 */

export interface IWhatsAppFormFlow {
  _id?: string;
  organization?: string;
  createdBy?: string;
  templateKey: string;
  name: string;
  description?: string;
  customization: Record<string, any>;
  status: 'draft' | 'published' | 'deprecated';
  metaFlowId?: string;
  metaFlowStatus?: string;
  flowJson?: Record<string, any>;
  messageTemplateId?: string;
  templateApprovalStatus?: 'pending_approval' | 'approved' | 'rejected' | 'unknown';
  publishedAt?: string;
  deprecatedAt?: string;
  stats?: {
    sent: number;
    completed: number;
    avgRating?: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface IFlowTemplate {
  key: string;
  name: string;
  description: string;
  category: string;
  customizationFields?: Array<{
    name: string;
    label: string;
    type: string;
    default?: string;
    required?: boolean;
  }>;
}

export interface ICreateFlowRequest {
  templateKey: string;
  name: string;
  customization?: Record<string, any>;
}

export interface IUpdateFlowRequest {
  name?: string;
  customization?: Record<string, any>;
}

export interface IListFlowsResponse {
  success: boolean;
  data: IWhatsAppFormFlow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface IFlowResponse {
  success: boolean;
  data: IWhatsAppFormFlow;
}

export interface IFlowTemplatesResponse {
  success: boolean;
  data: IFlowTemplate[];
}
