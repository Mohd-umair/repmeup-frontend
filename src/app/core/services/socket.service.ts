import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { StorageService } from './storage.service';

/**
 * Socket Service - Single Responsibility Principle
 * Handles real-time WebSocket communication
 * 
 * Dependencies: StorageService (abstraction)
 * Following Dependency Inversion Principle
 */
@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket | null = null;
  private connectionStatus = new Subject<boolean>();
  public connectionStatus$ = this.connectionStatus.asObservable();

  constructor(private storageService: StorageService) {}

  /**
   * Connect to Socket.IO server
   */
  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    const token = this.storageService.getToken();
    
    this.socket = io(environment.socketUrl, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling']
    });

    // Connection event handlers
    this.socket.on('connect', () => {
      console.log('✅ Socket.IO connected');
      this.connectionStatus.next(true);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket.IO disconnected:', reason);
      this.connectionStatus.next(false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
      this.connectionStatus.next(false);
    });
  }

  /**
   * Disconnect from Socket.IO server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Listen to a specific event
   */
  listen<T>(eventName: string): Observable<T> {
    return new Observable(subscriber => {
      if (!this.socket) {
        subscriber.error('Socket not connected');
        return;
      }

      this.socket.on(eventName, (data: T) => {
        subscriber.next(data);
      });

      // Cleanup function
      return () => {
        if (this.socket) {
          this.socket.off(eventName);
        }
      };
    });
  }

  /**
   * Emit an event to the server
   */
  emit(eventName: string, data?: any): void {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }

    this.socket.emit(eventName, data);
  }

  /**
   * Listen to new interactions
   */
  onNewInteraction(): Observable<any> {
    return this.listen('new_interaction');
  }

  /**
   * Listen to interaction updates
   */
  onInteractionUpdate(): Observable<any> {
    return this.listen('interaction_updated');
  }

  /**
   * Listen to notification events
   */
  onNotification(): Observable<any> {
    return this.listen('notification');
  }

  /**
   * Join organization room for real-time updates
   */
  joinOrganization(organizationId: string): void {
    this.emit('join_organization', { organizationId });
  }

  /**
   * Leave organization room
   */
  leaveOrganization(organizationId: string): void {
    this.emit('leave_organization', { organizationId });
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

