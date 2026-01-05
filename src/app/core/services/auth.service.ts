import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import { IApiResponse, IAuthResponse } from '../models/api-response.model';
import { IUser } from '../models/user.model';
import { Router } from '@angular/router';

/**
 * Auth Service - Single Responsibility Principle
 * Handles all authentication related operations
 * 
 * Dependencies: ApiService (abstraction), StorageService (abstraction)
 * Following Dependency Inversion Principle
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<IUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(
    private apiService: ApiService,
    private storageService: StorageService,
    private router: Router
  ) {
    this.checkAuth();
  }

  /**
   * Check if user is authenticated
   */
  private checkAuth(): void {
    const token = this.storageService.getToken();
    const user = this.storageService.getUser();
    
    if (token && user) {
      this.currentUserSubject.next(user);
      this.isAuthenticatedSubject.next(true);
    }
  }

  /**
   * Register new user
   */
  register(data: any): Observable<IApiResponse<IAuthResponse>> {
    return this.apiService.post<IApiResponse<IAuthResponse>>('/auth/register', data)
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.handleAuthSuccess(response.data);
          }
        })
      );
  }

  /**
   * Login user
   */
  login(email: string, password: string): Observable<IApiResponse<IAuthResponse>> {
    return this.apiService.post<IApiResponse<IAuthResponse>>('/auth/login', { email, password })
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.handleAuthSuccess(response.data);
          }
        })
      );
  }

  /**
   * Logout user
   */
  logout(): void {
    this.storageService.clearAll();
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(['/auth/login']);
  }

  /**
   * Get current user
   */
  getCurrentUser(): Observable<IApiResponse<IUser>> {
    return this.apiService.get<IApiResponse<IUser>>('/auth/me')
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.currentUserSubject.next(response.data);
            this.storageService.saveUser(response.data);
          }
        })
      );
  }

  /**
   * Update user profile
   */
  updateProfile(data: Partial<IUser>): Observable<IApiResponse<IUser>> {
    return this.apiService.put<IApiResponse<IUser>>('/auth/profile', data)
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.currentUserSubject.next(response.data);
            this.storageService.saveUser(response.data);
          }
        })
      );
  }

  /**
   * Change password
   */
  changePassword(currentPassword: string, newPassword: string): Observable<IApiResponse> {
    return this.apiService.put<IApiResponse>('/auth/change-password', {
      currentPassword,
      newPassword
    });
  }

  /**
   * Handle successful authentication
   */
  private handleAuthSuccess(authData: IAuthResponse): void {
    this.storageService.saveToken(authData.token);
    this.storageService.saveRefreshToken(authData.refreshToken);
    this.storageService.saveUser(authData.user);
    this.currentUserSubject.next(authData.user);
    this.isAuthenticatedSubject.next(true);
  }

  /**
   * Get token
   */
  getToken(): string | null {
    return this.storageService.getToken();
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return !!this.storageService.getToken();
  }

  /**
   * Get current user value
   */
  get currentUserValue(): IUser | null {
    return this.currentUserSubject.value;
  }
}

