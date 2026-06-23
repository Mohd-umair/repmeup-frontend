import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AppointmentService } from '../../core/services/appointment.service';
import { NotificationService } from '../../core/services/notification.service';
import { IService, IProvider, IDayWindow, WEEKDAYS } from '../../core/models/appointment.model';

function blankWeek(): Record<string, IDayWindow> {
  const wk: Record<string, IDayWindow> = {};
  for (const d of WEEKDAYS) {
    const off = d === 'sunday' || d === 'saturday';
    wk[d] = { enabled: !off, start: '09:00', end: '18:00' };
  }
  return wk;
}

@Component({
  selector: 'app-appointment-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './appointment-setup.component.html'
})
export class AppointmentSetupComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  readonly weekdays = WEEKDAYS;

  tab: 'services' | 'providers' = 'services';
  services: IService[] = [];
  providers: IProvider[] = [];
  loading = true;
  saving = false;

  // Service editor
  serviceModal = false;
  serviceForm: Partial<IService> = {};
  editingServiceId: string | null = null;

  // Provider editor
  providerModal = false;
  providerForm: Partial<IProvider> & { weeklyAvailability: Record<string, IDayWindow> } = { weeklyAvailability: blankWeek() };
  editingProviderId: string | null = null;

  constructor(private appt: AppointmentService, private notify: NotificationService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.reload();
    const qp = this.route.snapshot.queryParamMap;
    if (qp.get('gcal_connected')) this.notify.success(`Google Calendar connected${qp.get('provider') ? ' for ' + qp.get('provider') : ''}`);
    if (qp.get('gcal_error')) this.notify.error('Google Calendar connection failed: ' + qp.get('gcal_error'));
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  reload(): void {
    this.loading = true;
    this.appt.listServices(true).pipe(takeUntil(this.destroy$)).subscribe({ next: (s) => (this.services = s) });
    this.appt.listProviders(true).pipe(finalize(() => (this.loading = false)), takeUntil(this.destroy$))
      .subscribe({ next: (p) => (this.providers = p) });
  }

  serviceName(id?: string): string { return this.services.find((s) => s._id === id)?.name || '—'; }

  // ── Services ───────────────────────────────────────────────────────────────
  newService(): void {
    this.editingServiceId = null;
    this.serviceForm = { name: '', durationMin: 30, price: 0, currency: 'INR', bufferBeforeMin: 0, bufferAfterMin: 0, isActive: true, providers: [] };
    this.serviceModal = true;
  }
  editService(s: IService): void { this.editingServiceId = s._id; this.serviceForm = { ...s }; this.serviceModal = true; }
  saveService(): void {
    if (!this.serviceForm.name?.trim()) { this.notify.error('Service name is required'); return; }
    this.saving = true;
    const req = this.editingServiceId
      ? this.appt.updateService(this.editingServiceId, this.serviceForm)
      : this.appt.createService(this.serviceForm);
    req.pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => { this.notify.success('Service saved'); this.serviceModal = false; this.reload(); },
      error: () => this.notify.error('Failed to save service')
    });
  }
  deleteService(s: IService): void {
    this.appt.deleteService(s._id).subscribe({ next: () => { this.notify.success('Service removed'); this.reload(); }, error: () => this.notify.error('Failed') });
  }

  // ── Providers ──────────────────────────────────────────────────────────────
  newProvider(): void {
    this.editingProviderId = null;
    this.providerForm = { name: '', email: '', phone: '', title: '', timezone: 'Asia/Kolkata', services: [], isActive: true, weeklyAvailability: blankWeek() };
    this.providerModal = true;
  }
  editProvider(p: IProvider): void {
    this.editingProviderId = p._id;
    this.providerForm = { ...p, weeklyAvailability: { ...blankWeek(), ...(p.weeklyAvailability || {}) } };
    this.providerModal = true;
  }
  toggleProviderService(id: string): void {
    const list = this.providerForm.services || (this.providerForm.services = []);
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.push(id);
  }
  saveProvider(): void {
    if (!this.providerForm.name?.trim()) { this.notify.error('Provider name is required'); return; }
    this.saving = true;
    const body: Partial<IProvider> = {
      name: this.providerForm.name, email: this.providerForm.email, phone: this.providerForm.phone,
      title: this.providerForm.title, timezone: this.providerForm.timezone, services: this.providerForm.services,
      weeklyAvailability: this.providerForm.weeklyAvailability, isActive: this.providerForm.isActive
    };
    const req = this.editingProviderId ? this.appt.updateProvider(this.editingProviderId, body) : this.appt.createProvider(body);
    req.pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => { this.notify.success('Provider saved'); this.providerModal = false; this.reload(); },
      error: () => this.notify.error('Failed to save provider')
    });
  }
  deleteProvider(p: IProvider): void {
    this.appt.deleteProvider(p._id).subscribe({ next: () => { this.notify.success('Provider removed'); this.reload(); }, error: () => this.notify.error('Failed') });
  }

  connectGoogle(p: IProvider): void {
    this.appt.connectProviderGoogle(p._id).subscribe({
      next: (r) => { if (r.authUrl) window.location.href = r.authUrl; },
      error: () => this.notify.error('Could not start Google Calendar connect')
    });
  }
  disconnectGoogle(p: IProvider): void {
    this.appt.disconnectProviderGoogle(p._id).subscribe({ next: () => { this.notify.success('Disconnected'); this.reload(); }, error: () => this.notify.error('Failed') });
  }
}
