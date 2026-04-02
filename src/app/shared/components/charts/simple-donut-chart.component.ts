import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import ApexCharts from 'apexcharts';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

/**
 * Generic Apex donut — same layout/styling as inbox sentiment chart (legend bottom, hollow center).
 */
@Component({
  selector: 'app-simple-donut-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div>
      <div #chartEl [class.hidden]="!showChart"></div>
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
  @Input() height = 220;
  /** Label shown in the donut center (e.g. "Entries"). */
  @Input() centerLabel = 'Total';
  @Input() emptyMessage = 'No data yet';

  private chart: ApexCharts | null = null;
  private initialized = false;

  get showChart(): boolean {
    return this.activeSegments.length > 0 && this.total > 0;
  }

  private get activeSegments(): DonutSegment[] {
    return (this.segments || []).filter((s) => s.value > 0);
  }

  private get total(): number {
    return this.activeSegments.reduce((sum, s) => sum + s.value, 0);
  }

  private legendTextColor(): string {
    if (typeof document === 'undefined') return '#4b5563';
    return document.documentElement.classList.contains('dark') ? '#d1d5db' : '#4b5563';
  }

  ngAfterViewInit(): void {
    this.initialized = true;
    if (this.showChart) {
      // Defer one macrotask so the browser can paint and compute container dimensions
      setTimeout(() => this.renderChart(), 50);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.initialized) return;
    if (!changes['segments'] && !changes['height'] && !changes['centerLabel']) return;
    this.chart?.destroy();
    this.chart = null;
    if (this.showChart) {
      setTimeout(() => this.renderChart(), 50);
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private renderChart(): void {
    const segs = this.activeSegments;
    const total = this.total;
    if (!this.chartEl?.nativeElement || segs.length === 0 || total <= 0) return;

    this.chart?.destroy();

    const options = {
      series: segs.map((s) => s.value),
      labels: segs.map((s) => s.label),
      colors: segs.map((s) => s.color),
      chart: {
        type: 'donut',
        height: this.height,
        background: 'transparent',
        animations: { enabled: true, speed: 600 }
      },
      legend: {
        show: true,
        position: 'bottom',
        fontSize: '11px',
        labels: { colors: this.legendTextColor() }
      },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${val.toFixed(1)}%`,
        style: { colors: ['#fff'], fontSize: '11px', fontWeight: 600 }
      },
      plotOptions: {
        pie: {
          donut: {
            size: '65%',
            labels: {
              show: true,
              total: {
                show: true,
                label: this.centerLabel,
                color: '#9ca3af',
                formatter: () => total.toLocaleString()
              }
            }
          }
        }
      },
      tooltip: {
        theme: 'dark',
        y: { formatter: (val: number) => val.toLocaleString() }
      },
      responsive: [{ breakpoint: 480, options: { chart: { height: Math.min(this.height, 260) } } }]
    };

    this.chart = new ApexCharts(this.chartEl.nativeElement, options);
    this.chart.render();
  }
}
