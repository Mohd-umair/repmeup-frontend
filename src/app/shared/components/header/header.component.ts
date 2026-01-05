import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { IUser } from '../../../core/models/user.model';

/**
 * Header Component - Single Responsibility Principle
 * Displays top navigation bar with user info and actions
 */
@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  currentUser: IUser | null = null;
  showUserMenu = false;
  notifications = 3; // Mock notification count

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  logout(): void {
    this.authService.logout();
    this.showUserMenu = false;
  }

  getUserInitials(): string {
    if (!this.currentUser) return 'U';
    return `${this.currentUser.firstName.charAt(0)}${this.currentUser.lastName.charAt(0)}`.toUpperCase();
  }
}
