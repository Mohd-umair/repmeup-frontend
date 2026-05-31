import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-ops-data-table',
  standalone: true,
  imports: [CommonModule, PaginationComponent],
  template: `
    <div class="rounded-xl border overflow-hidden" style="border-color: var(--card-border); background-color: var(--surface-primary);">
      <div class="px-4 py-3 border-b flex items-center justify-between gap-2" style="border-color: var(--card-border);">
        <div>
          <span class="font-bold text-sm" style="color: var(--text-primary);">{{ title }}</span>
          <span class="text-xs ml-2" style="color: var(--text-muted);">{{ total }} records</span>
        </div>
        <ng-content select="[tableActions]"></ng-content>
      </div>

      @if (loading) {
        <div class="p-10 text-center text-sm" style="color: var(--text-muted);">
          <i class="fas fa-spinner fa-spin mr-2"></i>Loading…
        </div>
      } @else if (!rows.length) {
        <div class="p-10 text-center text-sm" style="color: var(--text-muted);">No records found.</div>
      } @else {
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b text-left text-xs uppercase tracking-wide" style="border-color: var(--card-border); color: var(--text-muted);">
                @for (col of columns; track col.key) {
                  <th class="px-4 py-3 font-semibold whitespace-nowrap">{{ col.label }}</th>
                }
                @if (showActions) {
                  <th class="px-4 py-3 w-16"></th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of rows; track trackRow(row)) {
                <tr
                  class="border-b cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
                  style="border-color: var(--card-border);"
                  (click)="rowClick.emit(row)"
                >
                  <ng-container *ngTemplateOutlet="rowTemplate; context: { $implicit: row }"></ng-container>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (total > pageSize) {
          <div class="px-4 py-3 border-t" style="border-color: var(--card-border);">
            <app-pagination
              [currentPage]="page"
              [totalItems]="total"
              [pageSize]="pageSize"
              (pageChange)="pageChange.emit($event)"
            />
          </div>
        }
      }
    </div>

    <ng-template #rowTemplate let-row>
      <ng-content></ng-content>
    </ng-template>
  `
})
export class OpsDataTableComponent {
  @Input({ required: true }) title = '';
  @Input() rows: unknown[] = [];
  @Input() columns: { key: string; label: string }[] = [];
  @Input() loading = false;
  @Input() total = 0;
  @Input() page = 1;
  @Input() pageSize = 30;
  @Input() showActions = true;
  @Input() trackRow: (row: unknown) => string = (row: any) => row?.id ?? '';

  @Output() rowClick = new EventEmitter<unknown>();
  @Output() pageChange = new EventEmitter<number>();
}
