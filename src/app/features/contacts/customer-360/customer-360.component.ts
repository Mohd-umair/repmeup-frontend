import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ContactService } from '../../../core/services/contact.service';
import { IContact } from '../../../core/models/contact.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PremiumSelectComponent, PremiumSelectOption } from '../../../shared/components/premium-select/premium-select.component';

type Tab = 'overview' | 'conversations' | 'activity' | 'orders' | 'notes' | 'tasks' | 'timeline';

interface CommPrefs {
  whatsapp: boolean;
  instagram: boolean;
  facebook: boolean;
  marketingConsent: boolean;
  doNotContact: boolean;
}

@Component({
  selector: 'app-customer-360',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PremiumSelectComponent],
  templateUrl: './customer-360.component.html',
  styleUrl: './customer-360.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Customer360Component implements OnChanges, OnDestroy {
  @Input() contactId: string | null = null;
  @Output() back = new EventEmitter<void>();
  @Output() deleted = new EventEmitter<void>();
  @Output() profileSaved = new EventEmitter<void>();

  contact: IContact | null = null;
  loading = false;
  savingProfile = false;
  tab: Tab = 'overview';
  notes: any[] = [];
  tasks: any[] = [];
  activity: any[] = [];
  orders: any[] = [];
  noteBody = '';
  taskTitle = '';
  tagInput = '';
  owners: { _id: string; firstName?: string; lastName?: string }[] = [];
  fieldDefs: { key: string; label: string; type: string }[] = [];
  fieldValues: Record<string, unknown> = {};

  /** Draft profile — saved only when user clicks Save profile. */
  draftLifecycle = 'lead';
  draftOwnerId = '';
  draftPrefs: CommPrefs = {
    whatsapp: true,
    instagram: true,
    facebook: true,
    marketingConsent: false,
    doNotContact: false
  };
  private savedSnapshot = '';

  readonly lifecycleOptions: PremiumSelectOption[] = [
    { value: 'lead', label: 'Lead', iconClass: 'fas fa-seedling', colorClass: 'text-gray-500' },
    { value: 'engaged', label: 'Engaged', iconClass: 'fas fa-comments', colorClass: 'text-blue-500' },
    { value: 'qualified', label: 'Qualified', iconClass: 'fas fa-star', colorClass: 'text-amber-500' },
    { value: 'customer', label: 'Customer', iconClass: 'fas fa-shopping-bag', colorClass: 'text-green-500' },
    { value: 'repeat_customer', label: 'Repeat customer', iconClass: 'fas fa-redo', colorClass: 'text-emerald-500' },
    { value: 'vip', label: 'VIP', iconClass: 'fas fa-crown', colorClass: 'text-rep-lime' },
    { value: 'at_risk', label: 'At risk', iconClass: 'fas fa-triangle-exclamation', colorClass: 'text-orange-500' },
    { value: 'churned', label: 'Churned', iconClass: 'fas fa-user-slash', colorClass: 'text-red-500' }
  ];

  readonly commPrefRows: { key: keyof CommPrefs; label: string; hint: string; icon: string }[] = [
    { key: 'whatsapp', label: 'WhatsApp', hint: 'Allow WhatsApp messages', icon: 'fab fa-whatsapp text-green-500' },
    { key: 'instagram', label: 'Instagram', hint: 'Allow Instagram DMs', icon: 'fab fa-instagram text-pink-500' },
    { key: 'facebook', label: 'Facebook', hint: 'Allow Facebook messages', icon: 'fab fa-facebook text-blue-600' },
    { key: 'marketingConsent', label: 'Marketing consent', hint: 'Promotional campaigns allowed', icon: 'fas fa-bullhorn text-amber-500' },
    { key: 'doNotContact', label: 'Do not contact', hint: 'Block all outbound outreach', icon: 'fas fa-ban text-red-500' }
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private contacts: ContactService,
    private notify: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.owners.length) {
      this.contacts.owners().pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => { this.owners = res.data || []; this.cdr.markForCheck(); }
      });
      this.contacts.customFields().pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          this.fieldDefs = (res.data || []).map((f) => ({ key: f.key, label: f.label, type: f.type }));
          this.cdr.markForCheck();
        }
      });
    }
    if (changes['contactId'] && this.contactId) this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get profileDirty(): boolean {
    return this.snapshotProfile() !== this.savedSnapshot;
  }

  get savedLifecycleLabel(): string {
    const stage = this.contact?.lifecycleStage || 'lead';
    return this.lifecycleOptions.find((o) => o.value === stage)?.label || 'Lead';
  }

  load(): void {
    if (!this.contactId) return;
    this.loading = true;
    this.contacts.getContact(this.contactId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.contact = res.data ?? null;
        this.syncDraftFromContact();
        this.loading = false;
        this.loadTab(this.tab);
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.notify.error('Could not load contact', 'Try again or go back to the list.');
        this.cdr.markForCheck();
      }
    });
  }

  syncDraftFromContact(): void {
    if (!this.contact) return;
    this.draftLifecycle = this.contact.lifecycleStage || 'lead';
    const owner = this.contact.owner;
    this.draftOwnerId = owner && typeof owner === 'object' && owner._id ? owner._id : (owner ? String(owner) : '');
    this.draftPrefs = {
      whatsapp: this.contact.communicationPreferences?.whatsapp !== false,
      instagram: this.contact.communicationPreferences?.instagram !== false,
      facebook: this.contact.communicationPreferences?.facebook !== false,
      marketingConsent: this.contact.communicationPreferences?.marketingConsent === true,
      doNotContact: !!this.contact.communicationPreferences?.doNotContact
    };
    this.fieldValues = { ...(this.contact.customFields || {}) };
    this.savedSnapshot = this.snapshotProfile();
  }

  markProfileDirty(): void {
    this.cdr.markForCheck();
  }

  onDraftLifecycleChange(value: string): void {
    this.draftLifecycle = value;
    this.markProfileDirty();
  }

  onDraftOwnerChange(value: string): void {
    this.draftOwnerId = value;
    this.markProfileDirty();
  }

  togglePref(key: keyof CommPrefs): void {
    this.draftPrefs = { ...this.draftPrefs, [key]: !this.draftPrefs[key] };
    this.markProfileDirty();
  }

  cancelProfileChanges(): void {
    this.syncDraftFromContact();
    this.cdr.markForCheck();
  }

  saveProfile(): void {
    if (!this.contactId || this.savingProfile || !this.profileDirty) return;
    this.savingProfile = true;
    this.cdr.markForCheck();

    this.contacts.updateContact(this.contactId, {
      lifecycleStage: this.draftLifecycle as IContact['lifecycleStage'],
      owner: this.draftOwnerId || null,
      communicationPreferences: { ...this.draftPrefs },
      customFields: this.fieldValues
    } as Partial<IContact>).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.savingProfile = false;
        this.notify.success('Profile saved', `Lifecycle updated to ${this.lifecycleLabel(this.draftLifecycle)}.`);
        this.load();
        this.profileSaved.emit();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.savingProfile = false;
        const msg = err?.error?.error || err?.error?.message || 'Could not save profile changes.';
        this.notify.error('Save failed', msg);
        this.cdr.markForCheck();
      }
    });
  }

  setTab(tab: Tab): void {
    this.tab = tab;
    this.loadTab(tab);
  }

  loadTab(tab: Tab): void {
    if (!this.contactId) return;
    if (tab === 'notes') {
      this.contacts.notes(this.contactId).pipe(takeUntil(this.destroy$)).subscribe({
        next: (r) => { this.notes = r.data || []; this.cdr.markForCheck(); }
      });
    }
    if (tab === 'tasks') {
      this.contacts.tasks(this.contactId).pipe(takeUntil(this.destroy$)).subscribe({
        next: (r) => { this.tasks = r.data || []; this.cdr.markForCheck(); }
      });
    }
    if (tab === 'activity' || tab === 'timeline') {
      this.contacts.activity(this.contactId).pipe(takeUntil(this.destroy$)).subscribe({
        next: (r) => { this.activity = r.data || []; this.cdr.markForCheck(); }
      });
    }
    if (tab === 'orders') {
      this.contacts.orders(this.contactId).pipe(takeUntil(this.destroy$)).subscribe({
        next: (r) => { this.orders = r.data || []; this.cdr.markForCheck(); }
      });
    }
  }

  addTag(): void {
    if (!this.contactId || !this.tagInput.trim() || !this.contact) return;
    const tags = [...(this.contact.tags || []), this.tagInput.trim()];
    this.contacts.updateContact(this.contactId, { tags }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.tagInput = ''; this.load(); this.profileSaved.emit(); }
    });
  }

  addNote(): void {
    if (!this.contactId || !this.noteBody.trim()) return;
    this.contacts.addNote(this.contactId, this.noteBody).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.noteBody = ''; this.loadTab('notes'); }
    });
  }

  addTask(): void {
    if (!this.contactId || !this.taskTitle.trim()) return;
    this.contacts.addTask(this.contactId, { title: this.taskTitle }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.taskTitle = ''; this.loadTab('tasks'); }
    });
  }

  completeTask(task: any): void {
    if (!this.contactId) return;
    this.contacts.updateTask(this.contactId, task._id, { status: 'done' }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.loadTab('tasks')
    });
  }

  refreshIntel(): void {
    if (!this.contactId) return;
    this.contacts.recompute(this.contactId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.load()
    });
  }

  summarize(): void {
    if (!this.contactId) return;
    this.contacts.generateSummary(this.contactId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.notify.success('Summary ready', 'AI customer summary updated.');
        this.load();
      }
    });
  }

  get ownerSelectOptions(): PremiumSelectOption[] {
    return [
      { value: '', label: 'Unassigned' },
      ...this.owners.map((o) => ({
        value: o._id,
        label: [o.firstName, o.lastName].filter(Boolean).join(' ') || 'User'
      }))
    ];
  }

  lifecycleLabel(value: string): string {
    return this.lifecycleOptions.find((o) => o.value === value)?.label || value;
  }

  lifecycleBadgeClass(stage: string): string {
    const map: Record<string, string> = {
      lead: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      engaged: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
      qualified: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
      customer: 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300',
      repeat_customer: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
      vip: 'bg-rep-lime/20 text-rep-black dark:text-rep-lime',
      at_risk: 'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300',
      churned: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'
    };
    return map[stage] || map['lead'];
  }

  nbaLabel(): string {
    const a = this.contact?.nextBestAction?.action;
    if (a === 'send_payment_link') return 'Send payment link';
    if (a === 'follow_up_whatsapp') return 'Send follow-up';
    if (a === 'assign_senior_support') return 'Assign to senior support';
    return '';
  }

  onFieldChange(key: string, value: unknown): void {
    this.fieldValues = { ...this.fieldValues, [key]: value };
    this.markProfileDirty();
  }

  private snapshotProfile(): string {
    return JSON.stringify({
      lifecycle: this.draftLifecycle,
      owner: this.draftOwnerId,
      prefs: this.draftPrefs,
      fields: this.fieldValues
    });
  }
}
