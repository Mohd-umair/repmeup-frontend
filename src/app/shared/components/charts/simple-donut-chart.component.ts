import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  SimpleChanges,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import ApexCharts from 'apexcharts';
import { Subscription, timer } from 'rxjs';
import { take } from 'rxjs/operators';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

/**
 * Generic Apex donut — clean center label, no built-in data-labels (they overlap
 * when there are many equal-size segments), custom HTML legend for full labels.
 */
@Component({
  selector: 'app-simple-donut-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div>
      <!-- Chart canvas -->
      <div #chartEl [class.hidden]="!showChart" class="w-full"></div>

      <!-- Custom legend — rendered in Angular so it never truncates -->
      <div *ngIf="showChart" class="mt-1 grid grid-cols-1 gap-y-1.5 px-1 pb-1"
           [class.grid-cols-2]="activeSegments.length > 4">
        <div *ngFor="let s of activeSegments"
             class="flex items-center gap-2 min-w-0">
          <span class="shrink-0 w-2.5 h-2.5 rounded-full"
                [style.background]="s.color"></span>
          <span class="truncate text-[11.5px] text-gray-600 dark:text-gray-400"
                [title]="s.label">{{ s.label }}</span>
          <span class="ml-auto shrink-0 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
            {{ pct(s.value) }}%
          </span>
        </div>
      </div>

      <!-- Empty state -->
      <div *ngIf="!showChart"
        class="flex flex-col items-center justify-center text-gray-500"
        [style.min-height.px]="height">
        <i class="fas fa-chart-pie text-3xl mb-2 text-gray-300 dark:text-gray-600"></i>
        <p class="text-[11px] text-center px-2">{{ emptyMessage }}</p>
      </div>
    </div>
  `
})
export class SimpleDonutChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('chartEl') chartEl!: ElementRef<HTMLElement>;

  /** Non-empty segments only; zero-value slices should be omitted by the parent. */
  @Input() segments: DonutSegment[] = [];
  @Input() height = 180;
  /** Label shown in the donut center (e.g. "Entries"). */
  @Input() centerLabel = 'Total';
  @Input() emptyMessage = 'No data yet';

  private chart: ApexCharts | null = null;
  private initialized = false;
  private deferRenderSub?: Subscription;

  constructor(private cdr: ChangeDetectorRef) {}

  get showChart(): boolean {
    return this.activeSegments.length > 0 && this.total > 0;
  }

  get activeSegments(): DonutSegment[] {
    return (this.segments || []).filter((s) => s.value > 0);
  }

  private get total(): number {
    return this.activeSegments.reduce((sum, s) => sum + s.value, 0);
  }

  pct(value: number): string {
    const t = this.total;
    if (!t) return '0.0';
    return ((value / t) * 100).toFixed(1);
  }

  ngAfterViewInit(): void {
    this.initialized = true;
    if (this.showChart) {
      this.scheduleRender();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.initialized) return;
    if (!changes['segments'] && !changes['height'] && !changes['centerLabel']) return;
    this.chart?.destroy();
    this.chart = null;
    if (this.showChart) {
      this.scheduleRender();
    }
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.deferRenderSub?.unsubscribe();
    this.chart?.destroy();
  }

  private scheduleRender(): void {
    this.deferRenderSub?.unsubscribe();
    this.deferRenderSub = timer(50)
      .pipe(take(1))
      .subscribe(() => {
        this.deferRenderSub = undefined;
        this.renderChart();
      });
  }

  private renderChart(): void {
    const segs = this.activeSegments;
    const total = this.total;
    if (!this.chartEl?.nativeElement || segs.length === 0 || total <= 0) return;

    this.chart?.destroy();

    const options: ApexCharts.ApexOptions = {
      series: segs.map((s) => s.value),
      labels: segs.map((s) => s.label),
      colors: segs.map((s) => s.color),
      chart: {
        type: 'donut',
        height: this.height,
        background: 'transparent',
        animations: { enabled: true, speed: 500 },
        toolbar: { show: false },
        sparkline: { enabled: false }
      },
      // Data labels OFF — they overflow and collide on many equal-sized segments.
      // Percentages are shown in the custom HTML legend instead.
      dataLabels: { enabled: false },
      // Legend OFF — replaced by the custom HTML legend above.
      legend: { show: false },
      plotOptions: {
        pie: {
          donut: {
            size: '68%',
            labels: {
              show: true,
              total: {
                show: true,
                showAlways: true,
                label: this.centerLabel,
                fontSize: '11px',
                fontWeight: 600,
                color: '#9ca3af',
                formatter: () => total.toLocaleString()
              },
            }
          }
        }
      },
      stroke: {
        width: segs.length > 5 ? 1 : 2,
        colors: ['#ffffff']
      },
      tooltip: {
        theme: 'dark',
        y: { formatter: (val: number) => `${val.toLocaleString()} uses` }
      },
      states: {
        hover: { filter: { type: 'lighten' } },
        active: { filter: { type: 'none' } }
      },
      responsive: [
        {
          breakpoint: 480,
          options: { chart: { height: Math.min(this.height, 180) } }
        }
      ]
    };

    this.chart = new ApexCharts(this.chartEl.nativeElement, options);
    this.chart.render();
  }
}
