import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PlatformService } from '../../../core/services/platform.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformConnectionService } from '../../../core/services/platform-connection.service';

export interface WhatsAppConnectionSummary {
  id: string;
  displayPhoneNumber: string;
  verifiedName: string;
  qualityRating: string;
  status: string;
}

@Component({
  selector: 'app-whatsapp-connect',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './whatsapp-connect.component.html'
})
export class WhatsAppConnectComponent implements OnInit, OnDestroy {
  /** Pass existing WhatsApp connections to display connected state */
  @Input() connections: WhatsAppConnectionSummary[] = [];

  /** Emitted when connections change so parent can refresh */
  @Output() connectionsChanged = new EventEmitter<void>();

  connecting = false;
  disconnecting: Record<string, boolean> = {};

  private destroy$ = new Subject<void>();

  constructor(
    private platformService: PlatformService,
    private notificationService: NotificationService,
    private platformConnectionService: PlatformConnectionService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Handle redirect back from Meta Embedded Signup
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['whatsapp_connected'] === 'true') {
        const count = params['count'] || '1';
        this.notificationService.success(
          'WhatsApp Connected',
          `${count} WhatsApp Business number(s) connected successfully!`
        );
        this.connectionsChanged.emit();
        // Clean query params
        this.router.navigate([], { queryParams: { tab: 'platforms' }, replaceUrl: true });
      } else if (params['whatsapp_error']) {
        this.notificationService.error('WhatsApp Connection Failed', decodeURIComponent(params['whatsapp_error']));
        this.router.navigate([], { queryParams: { tab: 'platforms' }, replaceUrl: true });
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---------------------------------------------------------------------------

  get isConnected(): boolean {
    return this.connections.length > 0;
  }

  get qualityColor(): (rating: string) => string {
    return (rating: string) => {
      switch ((rating || '').toUpperCase()) {
        case 'GREEN': return 'text-green-500';
        case 'YELLOW': return 'text-yellow-500';
        case 'RED': return 'text-red-500';
        default: return 'text-gray-400';
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Connect via Embedded Signup OAuth popup
  // ---------------------------------------------------------------------------

  async connect(): Promise<void> {
    this.connecting = true;
    try {
      const result = await this.platformService.connectWhatsAppOAuth();
      this.connectionsChanged.emit();
      this.platformConnectionService.refresh().subscribe();

      if (result.success) {
        this.notificationService.success(
          'WhatsApp Connected',
          `${result.count ?? 1} WhatsApp Business number(s) connected successfully!`
        );
      } else if (!result.cancelled && result.error) {
        this.notificationService.error('WhatsApp Connection Failed', result.error);
      }
    } catch (err: any) {
      this.notificationService.error(
        'Connection Failed',
        err?.message || 'Failed to open WhatsApp connection. Please allow popups and try again.'
      );
    } finally {
      this.connecting = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Disconnect
  // ---------------------------------------------------------------------------

  disconnect(connectionId: string): void {
    if (this.disconnecting[connectionId]) return;
    this.disconnecting[connectionId] = true;

    this.platformService.disconnectWhatsApp(connectionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notificationService.success('Disconnected', 'WhatsApp number disconnected successfully.');
          this.connectionsChanged.emit();
          this.platformConnectionService.refresh().subscribe();
        },
        error: (err: any) => {
          this.notificationService.error(
            'Disconnect Failed',
            err?.error?.error || err?.message || 'Failed to disconnect WhatsApp.'
          );
        },
        complete: () => { this.disconnecting[connectionId] = false; }
      });
  }
}
