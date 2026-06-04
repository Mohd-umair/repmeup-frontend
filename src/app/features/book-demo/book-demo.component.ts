import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, timer } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';

/** Must match backend `DEMO_TIME_SLOTS` in validation.js */
export const DEMO_TIME_SLOTS = [
  '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM',
  '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM',
  '05:00 PM', '05:30 PM'
] as const;

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

@Component({
  selector: 'app-book-demo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './book-demo.component.html',
  styleUrls: ['./book-demo.component.scss']
})
export class BookDemoComponent implements OnInit, OnDestroy {
  readonly timeSlots = DEMO_TIME_SLOTS;
  readonly teamSizeOptions = ['1–5', '6–20', '21–50', '51–200', '200+'];
  readonly timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

  demoForm: FormGroup;
  submitted = false;
  loading = false;
  success = false;
  submitError: string | null = null;

  /** Currently displayed month (always day 1). */
  calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  selectedDate: Date | null = null;
  selectedTime: string | null = null;
  /** Shown in success banner after submit (form state is cleared). */
  confirmedDateLabel = '';
  confirmedTime = '';

  private readonly destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService
  ) {
    this.demoForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.minLength(8)]],
      company: ['', [Validators.required, Validators.minLength(1)]],
      teamSize: [''],
      notes: ['']
    });
  }

  ngOnInit(): void {
    this.selectFirstAvailableDate();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get f() {
    return this.demoForm.controls;
  }

  get calendarTitle(): string {
    return this.calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  /** 42-cell grid (6 weeks) with leading/trailing padding days. */
  get calendarCells(): { date: Date; inMonth: boolean }[] {
    const year = this.calendarMonth.getFullYear();
    const month = this.calendarMonth.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = first.getDay();
    const cells: { date: Date; inMonth: boolean }[] = [];

    for (let i = 0; i < 42; i++) {
      const dayIndex = i - startOffset + 1;
      const date = new Date(year, month, dayIndex);
      cells.push({ date, inMonth: date.getMonth() === month });
    }
    return cells;
  }

  weekdayLabel(index: number): string {
    return WEEKDAY_LABELS[index];
  }

  prevMonth(): void {
    const d = new Date(this.calendarMonth);
    d.setMonth(d.getMonth() - 1);
    if (this.isMonthBeforeCurrent(d)) return;
    this.calendarMonth = d;
  }

  nextMonth(): void {
    const d = new Date(this.calendarMonth);
    d.setMonth(d.getMonth() + 1);
    this.calendarMonth = d;
  }

  canGoPrevMonth(): boolean {
    const prev = new Date(this.calendarMonth);
    prev.setMonth(prev.getMonth() - 1);
    return !this.isMonthBeforeCurrent(prev);
  }

  selectDate(date: Date): void {
    if (!this.isDateSelectable(date)) return;
    this.selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    this.selectedTime = null;
  }

  selectTime(slot: string): void {
    this.selectedTime = slot;
  }

  isSameDay(a: Date, b: Date | null): boolean {
    if (!b) return false;
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  isDateSelectable(date: Date): boolean {
    if (!date) return false;
    const day = date.getDay();
    if (day === 0 || day === 6) return false;

    const today = this.startOfDay(new Date());
    const target = this.startOfDay(date);
    if (target < today) return false;

    const max = new Date(today);
    max.setDate(max.getDate() + 60);
    if (target > max) return false;

    return true;
  }

  isDateDisabled(date: Date, inMonth: boolean): boolean {
    return !inMonth || !this.isDateSelectable(date);
  }

  formatSelectedDate(): string {
    if (!this.selectedDate) return '';
    return this.selectedDate.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  onSubmit(): void {
    this.submitted = true;
    this.submitError = null;

    if (!this.selectedDate) {
      this.submitError = 'Please pick a date for your demo.';
      return;
    }
    if (!this.selectedTime) {
      this.submitError = 'Please pick a time slot for your demo.';
      return;
    }
    if (!this.demoForm.valid) return;

    this.loading = true;
    this.success = false;

    const raw = this.demoForm.value;
    const body = {
      name: raw.name,
      email: raw.email,
      phone: raw.phone,
      company: raw.company,
      demoDate: this.toIsoDate(this.selectedDate),
      demoTime: this.selectedTime,
      timezone: this.timezone,
      teamSize: raw.teamSize || '',
      notes: raw.notes || ''
    };

    this.apiService
      .post<{ success: boolean; message: string; error?: string }>('/demo/book', body)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.loading = false;
          if (res.success) {
            this.confirmedDateLabel = this.formatSelectedDate();
            this.confirmedTime = this.selectedTime || '';
            this.success = true;
            this.demoForm.reset();
            this.submitted = false;
            this.selectedTime = null;
            this.selectFirstAvailableDate();
            timer(8000)
              .pipe(take(1), takeUntil(this.destroy$))
              .subscribe(() => {
                this.success = false;
              });
          } else {
            this.submitError = res.error || 'Something went wrong. Please try again.';
          }
        },
        error: (err) => {
          this.loading = false;
          this.submitError =
            err?.error?.error ||
            err?.error?.message ||
            'Could not schedule your demo. Please try again later.';
        }
      });
  }

  getFieldError(fieldName: string): string {
    const field = this.f[fieldName];
    if (field?.errors && this.submitted) {
      if (field.errors['required']) {
        return `${this.labelFor(fieldName)} is required`;
      }
      if (field.errors['email']) {
        return 'Please enter a valid email address';
      }
      if (field.errors['minlength']) {
        return `${this.labelFor(fieldName)} must be at least ${field.errors['minlength'].requiredLength} characters`;
      }
    }
    return '';
  }

  private labelFor(fieldName: string): string {
    const labels: Record<string, string> = {
      name: 'Full name',
      email: 'Email',
      phone: 'Phone',
      company: 'Company'
    };
    return labels[fieldName] || fieldName;
  }

  private startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private isMonthBeforeCurrent(month: Date): boolean {
    const now = new Date();
    return (
      month.getFullYear() < now.getFullYear() ||
      (month.getFullYear() === now.getFullYear() && month.getMonth() < now.getMonth())
    );
  }

  private selectFirstAvailableDate(): void {
    const cursor = this.startOfDay(new Date());
    for (let i = 0; i < 60; i++) {
      if (this.isDateSelectable(cursor)) {
        this.selectedDate = new Date(cursor);
        this.calendarMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        return;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
}
