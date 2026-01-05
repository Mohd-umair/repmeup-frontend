export interface IUser {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  organization: string | IOrganization;
  avatar?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLogin?: Date;
  preferences: IUserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  AGENT = 'agent',
  VIEWER = 'viewer'
}

export interface IUserPreferences {
  notifications: boolean;
  emailDigest: boolean;
  emailFrequency: 'instant' | 'daily' | 'weekly';
  theme: 'light' | 'dark';
  language: string;
  timezone: string;
}

export interface IOrganization {
  _id: string;
  name: string;
  slug: string;
  logo?: string;
  website?: string;
  subscription: ISubscription;
  limits: ILimits;
  usage: IUsage;
  isActive: boolean;
}

export interface ISubscription {
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  startDate: Date;
  endDate?: Date;
}

export interface ILimits {
  maxUsers: number;
  maxPlatformConnections: number;
  maxInteractionsPerMonth: number;
  maxAICreditsPerMonth: number;
}

export interface IUsage {
  currentUsers: number;
  currentPlatformConnections: number;
  interactionsThisMonth: number;
  aiCreditsUsedThisMonth: number;
}

