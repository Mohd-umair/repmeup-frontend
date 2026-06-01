import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { IApiResponse, IPagination } from '../models/api-response.model';

export interface IUser {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'agent' | 'viewer';
  organization: string;
  avatar?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLogin?: Date;
  preferences?: {
    notifications: boolean;
    emailDigest: boolean;
    emailFrequency: 'instant' | 'daily' | 'weekly';
    theme: 'light' | 'dark';
    language: string;
    timezone: string;
  };
  createdAt: Date;
  updatedAt: Date;
  assignedBuckets?: { _id: string; name: string; color?: string }[] | string[];
  assignedPlatforms?: string[];
  assignedTasks?: number;
  resolvedToday?: number;
}

export interface IUserStats {
  user: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  stats: {
    assignedTasks: number;
    resolvedToday: number;
    resolvedThisWeek: number;
    resolvedThisMonth: number;
    totalResolved: number;
    avgResponseTimeMinutes: number;
  };
}

export interface IAvailableAgent {
  _id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  role: string;
  currentWorkload: number;
}

export interface IUsersPagedResponse {
  success: boolean;
  data: IUser[];
  pagination: IPagination;
}

export interface ICreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: 'admin' | 'manager' | 'agent' | 'viewer';
  assignedBuckets?: string[];
  assignedPlatforms?: string[];
}

export interface IUpdateUserDto {
  firstName?: string;
  lastName?: string;
  role?: 'admin' | 'manager' | 'agent' | 'viewer';
  isActive?: boolean;
  assignedBuckets?: string[];
  assignedPlatforms?: string[];
  preferences?: {
    notifications?: boolean;
    emailDigest?: boolean;
    negativeSentimentAlerts?: boolean;
    weeklyReports?: boolean;
    emailFrequency?: 'instant' | 'daily' | 'weekly';
    theme?: 'light' | 'dark';
    language?: string;
    timezone?: string;
  };
}

/**
 * User Service
 * Handles user/agent management API operations
 */
@Injectable({
  providedIn: 'root'
})
export class UserService {
  constructor(private apiService: ApiService) {}

  /**
   * Get all users in organization (paginated)
   */
  getUsers(params?: { role?: string; status?: string; search?: string; page?: number; limit?: number }): Observable<IUsersPagedResponse> {
    return this.apiService.get<IUsersPagedResponse>('/users', params);
  }

  /**
   * Get single user by ID
   */
  getUserById(id: string): Observable<IApiResponse<IUser>> {
    return this.apiService.get<IApiResponse<IUser>>(`/users/${id}`);
  }

  /**
   * Create new user
   */
  createUser(data: ICreateUserDto): Observable<IApiResponse<IUser>> {
    return this.apiService.post<IApiResponse<IUser>>('/users', data);
  }

  /**
   * Update user
   */
  updateUser(id: string, data: IUpdateUserDto): Observable<IApiResponse<IUser>> {
    return this.apiService.put<IApiResponse<IUser>>(`/users/${id}`, data);
  }

  /**
   * Delete user (soft delete)
   */
  deleteUser(id: string): Observable<IApiResponse<void>> {
    return this.apiService.delete<IApiResponse<void>>(`/users/${id}`);
  }

  /**
   * Get user statistics
   */
  getUserStats(id: string): Observable<IApiResponse<IUserStats>> {
    return this.apiService.get<IApiResponse<IUserStats>>(`/users/${id}/stats`);
  }

  /**
   * Get available agents for assignment
   */
  getAvailableAgents(): Observable<IApiResponse<IAvailableAgent[]>> {
    return this.apiService.get<IApiResponse<IAvailableAgent[]>>('/inbox/agents');
  }
}

