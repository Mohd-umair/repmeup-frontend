/** Appointment booking domain models (frontend). Mirrors the backend payloads. */

export type AppointmentStatus =
  | 'requested' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled';

export interface IApptStatCard {
  label: string;
  value: string | number;
  sub?: string;
  tone?: string;
}

export interface IApptRow {
  id: string;
  displayRef: string;
  customerName: string;
  customerHandle: string;
  channel: string;
  channelLabel: string;
  serviceName: string;
  providerName: string;
  durationLabel: string;
  priceFormatted: string;
  startAt: string;
  endAt: string;
  whenLabel: string;
  timezone: string;
  status: AppointmentStatus;
  statusLabel: string;
  statusTone: string;
  createdAt: string;
  sourceInteractionId: string | null;
  chatDeepLink: string | null;
}

export interface IApptTimelineEvent {
  event: string;
  at: string | null;
  atLabel: string;
  pending: boolean;
}

export interface IApptDetail extends IApptRow {
  serviceId: string | null;
  providerId: string | null;
  customer: { name: string; handle: string; avatarUrl: string | null };
  service: { name?: string; durationMin?: number; price?: number; currency?: string } | null;
  provider: { name?: string } | null;
  notes: string | null;
  payment: { required: boolean; amount: string; method: string | null; paid: boolean } | null;
  cancellationReason: string | null;
  reminders: { offsetMin: number; sentAt: string | null; channel: string | null }[];
  timeline: IApptTimelineEvent[];
  actions: { canUpdateStatus: boolean; nextStatuses: AppointmentStatus[]; canReschedule: boolean };
}

export interface IApptStats {
  totalAppointments: number;
  upcoming: number;
  today: number;
  completed: number;
  noShow: number;
  statusCounts: Record<string, number>;
}

export interface IApptListResult {
  rows: IApptRow[];
  total: number;
  page: number;
  limit: number;
}

export interface IService {
  _id: string;
  name: string;
  description?: string;
  category?: string;
  durationMin: number;
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
  price?: number;
  currency?: string;
  providers?: string[];
  color?: string;
  isActive: boolean;
}

export interface IDayWindow { enabled: boolean; start: string; end: string; }

export interface IProvider {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  avatarUrl?: string;
  services?: string[];
  timezone?: string;
  weeklyAvailability?: Record<string, IDayWindow>;
  timeOff?: { from: string; to: string; reason?: string }[];
  isActive: boolean;
  google?: { connected?: boolean; calendarId?: string };
}

export interface ISlot {
  providerId: string;
  providerName: string;
  startAt: string;
  endAt: string;
  date: string;
  timeLabel: string;
  timezone: string;
}

export interface IAvailability {
  service: { id: string; name: string; durationMin: number; price?: number; currency?: string };
  slots: ISlot[];
  byDate: Record<string, ISlot[]>;
}

export const APPOINTMENT_CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'voice', label: 'Voice' },
  { value: 'manual', label: 'Manual' }
];

export const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
