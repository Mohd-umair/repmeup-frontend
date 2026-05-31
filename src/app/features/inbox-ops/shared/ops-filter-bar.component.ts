import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IOpsFilterTab } from '../../../core/models/inbox-ops.model';

@Component({
  selector: 'app-ops-filter-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="flex flex-col lg:flex-row lg:items-center gap-3 mb-4 p-3 rounded-xl border"
      style="border-color: var(--card-border); background-color: var(--surface-primary);"
    >
      <div class="flex flex-wrap gap-1.5">
        @for (tab of tabs; track tab.value) {
          <button
            type="button"
            (click)="selectTab(tab.value)"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
            [class.bg-rep-lime]="activeTab === tab.value"
            [class.text-rep-black]="activeTab === tab.value"
            [style.color]="activeTab === tab.value ? undefined : 'var(--text-secondary)'"
            [style.background-color]="activeTab === tab.value ? undefined : 'transparent'"
          >
            {{ tab.label }}
          </button>
        }
      </div>
      <div class="flex flex-wrap items-center gap-2 lg:ml-auto">
        <input
          type="search"
          [(ngModel)]="search"
          (ngModelChange)="searchChange.emit($event)"
          placeholder="Search…"
          class="text-sm px-3 py-1.5 rounded-lg border min-w-[160px]"
          style="border-color: var(--card-border); background-color: var(--bg-primary); color: var(--text-primary);"
        />
        @if (channelOptions.length) {
          <select
            [(ngModel)]="channel"
            (ngModelChange)="channelChange.emit($event)"
            class="text-sm px-3 py-1.5 rounded-lg border"
            style="border-color: var(--card-border); background-color: var(--bg-primary); color: var(--text-primary);"
          >
            <option value="">All channels</option>
            @for (c of channelOptions; track c.value) {
              <option [value]="c.value">{{ c.label }}</option>
            }
          </select>
        }
      </div>
    </div>
  `
})
export class OpsFilterBarComponent {
  @Input({ required: true }) tabs: IOpsFilterTab[] = [];
  @Input() activeTab = 'all';
  @Input() search = '';
  @Input() channel = '';
  @Input() channelOptions: { value: string; label: string }[] = [];

  @Output() tabChange = new EventEmitter<string>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() channelChange = new EventEmitter<string>();

  selectTab(value: string): void {
    this.activeTab = value;
    this.tabChange.emit(value);
  }
}
