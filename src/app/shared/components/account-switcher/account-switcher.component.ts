import { Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { AccountContextService } from '../../../core/services/account-context.service';
import { PermissionService } from '../../../core/services/permission.service';
import { PlatformConnection, PlatformConnectionService } from '../../../core/services/platform-connection.service';

interface PlatformGroup {
  platform: string;
  label: string;
  icon: string;
  connections: PlatformConnection[];
}

@Component({
  selector: 'app-account-switcher',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './account-switcher.component.html',
  styleUrls: ['./account-switcher.component.scss']
})
export class AccountSwitcherComponent implements OnInit, OnDestroy {
  showMenu = false;
  visible = false;
  selected: PlatformConnection | null = null;
  groups: PlatformGroup[] = [];

  private subscriptions: Subscription[] = [];

  private readonly platformIcons: Record<string, string> = {
    instagram: 'fab fa-instagram',
    facebook: 'fab fa-facebook-f',
    youtube: 'fab fa-youtube',
    google: 'fab fa-google',
    linkedin: 'fab fa-linkedin',
    whatsapp: 'fab fa-whatsapp'
  };

  private readonly platformLabels: Record<string, string> = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    youtube: 'YouTube',
    google: 'Google Business',
    linkedin: 'LinkedIn',
    whatsapp: 'WhatsApp'
  };

  constructor(
    private accountContext: AccountContextService,
    private permissionService: PermissionService,
    private platformConnectionService: PlatformConnectionService,
    private elRef: ElementRef<HTMLElement>
  ) {}

  ngOnInit(): void {
    this.subscriptions.push(
      combineLatest([
        this.platformConnectionService.connections$,
        this.accountContext.selectedConnection$,
        this.permissionService.permissions$
      ]).pipe(
        map(([connections, selected, permissions]) => {
          const canSwitch = permissions.has('accounts.switch');
          const active = this.accountContext.getActiveConnections(connections);
          return { canSwitch, active, selected };
        })
      ).subscribe(({ canSwitch, active, selected }) => {
        this.visible = canSwitch && active.length >= 2;
        this.selected = selected;
        this.groups = this.buildGroups(active);
        if (!this.visible) {
          this.showMenu = false;
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    if (!this.showMenu) return;
    if (this.elRef.nativeElement.contains(ev.target as Node)) return;
    this.showMenu = false;
  }

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.showMenu = !this.showMenu;
  }

  selectAll(event: MouseEvent): void {
    event.stopPropagation();
    this.accountContext.selectAllAccounts();
    this.showMenu = false;
  }

  selectConnection(connection: PlatformConnection, event: MouseEvent): void {
    event.stopPropagation();
    this.accountContext.selectConnection(connection);
    this.showMenu = false;
  }

  isSelected(connectionId: string | null): boolean {
    if (!connectionId) return this.selected === null;
    return this.selected?._id === connectionId;
  }

  getTriggerLabel(): string {
    if (!this.selected) return 'All accounts';
    return this.getConnectionLabel(this.selected);
  }

  getConnectionLabel(connection: PlatformConnection): string {
    const platform = (connection.platform || '').toLowerCase();
    if (platform === 'instagram') {
      const u = connection.platformUsername || connection.platformDisplayName;
      return u ? (u.startsWith('@') ? u : `@${u}`) : 'Instagram';
    }
    if (platform === 'whatsapp') {
      return connection.platformData?.displayPhoneNumber
        || connection.platformDisplayName
        || connection.platformUsername
        || 'WhatsApp';
    }
    if (platform === 'facebook') {
      return connection.platformDisplayName || connection.platformUsername || 'Facebook Page';
    }
    return connection.platformDisplayName
      || connection.platformUsername
      || connection.platformEmail
      || this.getPlatformLabel(platform);
  }

  getPlatformLabel(platform: string): string {
    return this.platformLabels[platform] || platform;
  }

  getPlatformIcon(platform: string): string {
    return this.platformIcons[platform] || 'fas fa-link';
  }

  getAvatarUrl(connection: PlatformConnection): string | null {
    return connection.platformProfilePicture || connection.metadata?.profilePicture || null;
  }

  private buildGroups(connections: PlatformConnection[]): PlatformGroup[] {
    const byPlatform = new Map<string, PlatformConnection[]>();
    for (const conn of connections) {
      const key = conn.platform || 'other';
      if (!byPlatform.has(key)) byPlatform.set(key, []);
      byPlatform.get(key)!.push(conn);
    }

    return Array.from(byPlatform.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([platform, list]) => ({
        platform,
        label: this.getPlatformLabel(platform),
        icon: this.getPlatformIcon(platform),
        connections: [...list].sort((a, b) =>
          this.getConnectionLabel(a).localeCompare(this.getConnectionLabel(b))
        )
      }));
  }
}
