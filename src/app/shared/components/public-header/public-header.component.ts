import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AppearanceService } from '../../../core/services/appearance.service';
import { PublicNavigationService } from '../../../core/services/public-navigation.service';
import { IUser } from '../../../core/models/user.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-public-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './public-header.component.html',
  styleUrls: ['./public-header.component.scss'],
})
export class PublicHeaderComponent implements OnInit, OnDestroy {
  currentUser: IUser | null = null;
  showUserMenu = false;
  showMobileMenu = false;
  private userSub?: Subscription;

  constructor(
    private router: Router,
    private authService: AuthService,
    public appearance: AppearanceService,
    private publicNav: PublicNavigationService
  ) {}

  ngOnInit(): void {
    this.userSub = this.authService.currentUser$.subscribe((u) => (this.currentUser = u));
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
  }

  goSection(id: string): void {
    this.publicNav.goToHomeSection(id);
  }

  navigateToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  navigateToRegister(): void {
    this.router.navigate(['/auth/register']);
  }

  navigateToDashboard(): void {
    this.router.navigate(['/app/dashboard']);
  }

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  logout(): void {
    this.authService.logout();
    this.showUserMenu = false;
    this.router.navigate(['/']);
  }

  getUserInitials(): string {
    if (!this.currentUser) return 'U';
    return `${this.currentUser.firstName?.charAt(0) || ''}${this.currentUser.lastName?.charAt(0) || ''}`.toUpperCase() || 'U';
  }
}
