import { IProductWhatsAppSyncResult } from './product.model';

export interface IApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  whatsappSync?: IProductWhatsAppSyncResult;
}

export interface IPaginatedResponse<T> {
  items: T[];
  pagination: IPagination;
}

export interface IPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface IAuthResponse {
  user: any;
  token: string;
  refreshToken: string;
}

/** Payload from POST /auth/register when email verification is required */
export interface IRegisterResponse {
  user: any;
  organization?: any;
  requiresEmailVerification?: boolean;
  message?: string;
  token?: string;
  refreshToken?: string;
}
