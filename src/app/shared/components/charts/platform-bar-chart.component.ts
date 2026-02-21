import {
  Component, Input, OnChanges, OnDestroy, AfterViewInit,
  ElementRef, ViewChild, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import ApexCharts from 'apexcharts';
import { IPlatformMetrics } from '../../../core/models/analytics.model';

@Component({
  selector: 'app-platform-bar-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div>
      <!-- Chart element — hidden via CSS so @ViewChild stays alive -->
      <div #chartEl [class.hidden]="!platforms?.length"></div>

      <div *ngIf="!platforms?.length"
           class="flex flex-col items-center justify-center h-48 text-gray-500">
        <i class="fas fa-chart-bar text-4xl mb-3 text-gray-700"></i>
        <p class="text-sm">No platform data available</p>
      </div>
    </div>
  `
})
export class PlatformBarChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('chartEl') chartEl!: ElementRef;
  @Input() platforms: IPlatformMetrics[] = [];
  @Input() height = 300;

  private chart: ApexCharts | null = null;
  private initialized = false;

  ngAfterViewInit(): void {
    this.initialized = true;
    if (this.platforms?.length) this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.initialized || !changes['platforms']) return;
    this.chart?.destroy();
    this.chart = null;
    if (this.platforms?.length) this.renderChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private renderChart(): void {
    this.chart?.destroy();
    const sorted = [...this.platforms].sort((a, b) => b.totalInteractions - a.totalInteractions);
    const options = {
      series: [
        { name: 'Total',     data: sorted.map(p => p.totalInteractions) },
        { name: 'Responded', data: sorted.map(p => p.responded) },
        { name: 'Pending',   data: sorted.map(p => p.pending) }
      ],
      chart: {
        type: 'bar',
        height: this.height,
        background: 'transparent',
        toolbar: { show: false },
        animations: { enabled: true, speed: 600 }
      },
      colors: ['#c8f135', '#10B981', '#F59E0B'],
      xaxis: {
        categories: sorted.map(p => p.platform.charAt(0).toUpperCase() + p.platform.slice(1)),
        labels: { style: { colors: '#9ca3af' } }
      },
      yaxis: { labels: { style: { colors: '#9ca3af' } } },
      plotOptions: { bar: { borderRadius: 5, columnWidth: '55%' } },
      dataLabels: { enabled: false },
      grid: { borderColor: '#1f2937', strokeDashArray: 4 },
      legend: { show: true, labels: { colors: '#d1d5db' }, position: 'top' },
      tooltip: {
        theme: 'dark',
        y: { formatter: (val: number) => val.toLocaleString() }
      }
    };
    this.chart = new ApexCharts(this.chartEl.nativeElement, options);
    this.chart.render();
  }
}
