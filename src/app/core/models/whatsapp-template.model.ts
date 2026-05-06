// ── Enums ─────────────────────────────────────────────────────────────────────
export type TemplateCategory = 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
export type TemplateStatus =
  | 'PENDING' | 'APPROVED' | 'IN_REVIEW' | 'REJECTED'
  | 'PAUSED' | 'DISABLED' | 'APPEAL_REQUESTED' | 'DELETED';
export type ParameterFormat = 'POSITIONAL' | 'NAMED';
export type HeaderFormat = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
export type ButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE' | 'OTP' | 'FLOW' | 'CATALOG';
export type OtpType = 'COPY_CODE' | 'ONE_TAP' | 'ZERO_TAP';

// ── Component types ───────────────────────────────────────────────────────────
export interface NamedParam {
  param_name: string;
  example: string;
}

export interface ComponentExample {
  header_text?: string[];
  body_text?: string[][];
  header_handle?: string[];
  header_text_named_params?: NamedParam[];
  body_text_named_params?: NamedParam[];
}

export interface TemplateButton {
  type: ButtonType;
  text?: string;
  url?: string;
  phone_number?: string;
  otp_type?: OtpType;
  example?: string[];
}

export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: HeaderFormat;        // HEADER only
  text?: string;
  example?: ComponentExample;
  buttons?: TemplateButton[];   // BUTTONS only
  add_security_recommendation?: boolean;  // AUTH
  code_expiration_minutes?: number;       // AUTH
}

// ── Template payload (create request) ────────────────────────────────────────
export interface CreateTemplatePayload {
  connectionId?: string;
  name: string;
  category: TemplateCategory;
  language: string;
  parameter_format?: ParameterFormat;
  components: TemplateComponent[];
}

// ── Template (as returned by Meta / our DB) ───────────────────────────────────
export interface WhatsAppTemplate {
  _id?: string;
  id?: string;            // Meta template id
  metaTemplateId?: string;
  name: string;
  category: TemplateCategory;
  language: string;
  parameter_format?: ParameterFormat;
  components: TemplateComponent[];
  status: TemplateStatus;
  quality_score?: { score: string };
  qualityScore?: string;
  rejected_reason?: string;
  rejectedReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ── API responses ─────────────────────────────────────────────────────────────
export interface TemplateListResponse {
  success: boolean;
  source: 'meta' | 'db_fallback';
  templates: WhatsAppTemplate[];
}

export interface TemplateSingleResponse {
  success: boolean;
  data: WhatsAppTemplate;
}

export interface TemplateCreateResponse {
  success: boolean;
  data: WhatsAppTemplate;
  message?: string;
}
/** Response from POST /whatsapp-templates/upload-header-example */
export interface TemplateHeaderUploadResponse {
  success: boolean;
  handle: string;
  fileType?: string;
  suggestedHeaderFormat?: string;
}

// ── Language options ──────────────────────────────────────────────────────────
export const TEMPLATE_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en_US', label: 'English (US)' },
  { code: 'en_GB', label: 'English (UK)' },
  { code: 'ar',    label: 'Arabic' },
  { code: 'de',    label: 'German' },
  { code: 'es',    label: 'Spanish (Spain)' },
  { code: 'es_AR', label: 'Spanish (Argentina)' },
  { code: 'es_MX', label: 'Spanish (Mexico)' },
  { code: 'fr',    label: 'French' },
  { code: 'hi',    label: 'Hindi' },
  { code: 'id',    label: 'Indonesian' },
  { code: 'it',    label: 'Italian' },
  { code: 'ja',    label: 'Japanese' },
  { code: 'ko',    label: 'Korean' },
  { code: 'nl',    label: 'Dutch' },
  { code: 'pt_BR', label: 'Portuguese (Brazil)' },
  { code: 'pt_PT', label: 'Portuguese (Portugal)' },
  { code: 'ru',    label: 'Russian' },
  { code: 'sv',    label: 'Swedish' },
  { code: 'tr',    label: 'Turkish' },
  { code: 'zh_CN', label: 'Chinese (Simplified)' },
  { code: 'zh_HK', label: 'Chinese (Hong Kong)' },
  { code: 'zh_TW', label: 'Chinese (Taiwan)' }
];
