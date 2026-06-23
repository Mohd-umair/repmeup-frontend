import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { AppointmentService } from '../../core/services/appointment.service';
import { NotificationService } from '../../core/services/notification.service';
import { IService, IProvider, ISlot } from '../../core/models/appointment.model';

/**
 * Booking modal — pick service → (optional) provider → date → slot, then create a
 * new appointment OR reschedule an existing one. Availability is computed by the
 * backend; this only displays and selects.
 */
@Component({
  selector: 'app-appointment-booking-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './appointment-booking-modal.component.html'
})
export class AppointmentBookingModalComponent implements OnInit {
  /** 'create' books a new appointment; 'reschedule' moves an existing one. */
  @Input() mode: 'create' | 'reschedule' = 'create';
  @Input() rescheduleId: string | null = null;
  /** Pre-pick the service when rescheduling. */
  @Input() presetServiceId: string | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() booked = new EventEmitter<void>();

  services: IService[] = [];
  providers: IProvider[] = [];
  loadingCatalog = true;
  loadingSlots = false;
  booking = false;

  serviceId = '';
  providerId = '';            // '' = any available
  byDate: Record<string, ISlot[]> = {};
  dateKeys: string[] = [];
  selected: ISlot | null = null;

  customerName = '';
  customerPhone = '';

  constructor(private appt: AppointmentService, private notify: NotificationService) {}

  ngOnInit(): void {
    Promise.resolve().then(() => {
      this.appt.listServices().subscribe({
        next: (s) => {
          this.services = s;
          if (this.presetServiceId) this.serviceId = this.presetServiceId;
          else if (s.length === 1) this.serviceId = s[0]._id;
          if (this.serviceId) this.onServiceChange();
        },
        error: () => this.notify.error('Failed to load services')
      });
      this.appt.listProviders().pipe(finalize(() => (this.loadingCatalog = false)))
        .subscribe({ next: (p) => (this.providers = p), error: () => (this.providers = []) });
    });
  }

  get providersForService(): IProvider[] {
    if (!this.serviceId) return this.providers;
    return this.providers.filter((p) => !p.services?.length || p.services.includes(this.serviceId));
  }

  onServiceChange(): void {
    this.providerId = '';
    this.selected = null;
    this.loadSlots();
  }

  loadSlots(): void {
    if (!this.serviceId) { this.byDate = {}; this.dateKeys = []; return; }
    this.loadingSlots = true;
    this.selected = null;
    this.appt.availability(this.serviceId, this.providerId || undefined, 14)
      .pipe(finalize(() => (this.loadingSlots = false)))
      .subscribe({
        next: (a) => {
          this.byDate = a.byDate || {};
          this.dateKeys = Object.keys(this.byDate).sort();
        },
        error: () => this.notify.error('Failed to load availability')
      });
  }

  pick(slot: ISlot): void { this.selected = slot; }

  dateLabel(key: string): string {
    const d = new Date(key + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  confirm(): void {
    if (!this.selected) { this.notify.error('Pick a time slot'); return; }
    this.booking = true;

    const done = () => (this.booking = false);
    if (this.mode === 'reschedule' && this.rescheduleId) {
      this.appt.reschedule(this.rescheduleId, { startAt: this.selected.startAt, providerId: this.selected.providerId })
        .pipe(finalize(done))
        .subscribe({
          next: () => { this.notify.success('Appointment rescheduled'); this.booked.emit(); this.close.emit(); },
          error: (e) => this.notify.error(e?.error?.error === 'slot_taken' ? 'That slot was just taken — pick another' : 'Failed to reschedule')
        });
      return;
    }

    this.appt.create({
      channel: 'manual',
      serviceId: this.serviceId,
      providerId: this.selected.providerId,
      startAt: this.selected.startAt,
      customerName: this.customerName.trim() || undefined,
      customerPhone: this.customerPhone.trim() || undefined,
      status: 'confirmed'
    }).pipe(finalize(done))
      .subscribe({
        next: () => { this.notify.success('Appointment booked'); this.booked.emit(); this.close.emit(); },
        error: (e) => this.notify.error(e?.error?.error === 'slot_taken' ? 'That slot was just taken — pick another' : 'Failed to book appointment')
      });
  }
}
