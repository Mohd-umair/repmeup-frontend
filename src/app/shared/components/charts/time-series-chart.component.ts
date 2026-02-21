import {
  Component, Input, OnChanges, OnDestroy, AfterViewInit,
  ElementRef, ViewChild, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import ApexCharts from 'apexcharts';
import { ITimeSeriesData } from '../../../core/models/analytics.model';

@Component({
  selector: 'app-time-series-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div>
      <!-- Custom legend sits above the chart, never overlapping -->
      <div *ngIf="data?.length" class="flex items-center gap-6 mb-3 px-1">
        <div class="flex items-center gap-2">
          <span class="inline-block w-8 h-0.5 rounded" style="background:#c8f135;"></span>
          <span class="text-sm text-gray-300">Interactions</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="inline-block w-8 h-0.5 rounded" style="background:#3B82F6;"></span>
          <span class="text-sm text-gray-300">Responses</span>
        </div>
      </div>

      <!-- Chart element — hidden via CSS so @ViewChild stays alive -->
      <div #chartEl [class.hidden]="!data?.length"></div>

      <div *ngIf="!data?.length"
           class="flex flex-col items-center justify-center h-48 text-gray-500">
        <i class="fas fa-chart-line text-4xl mb-3 text-gray-700"></i>
        <p class="text-sm">No data available for this period</p>
      </div>
    </div>
  `
})
export class TimeSeriesChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('chartEl') chartEl!: ElementRef;
  @Input() data: ITimeSeriesData[] = [];
  @Input() height = 320;

  private chart: ApexCharts | null = null;
  private initialized = false;

  ngAfterViewInit(): void {
    this.initialized = true;
    if (this.data?.length) this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.initialized || !changes['data']) return;
    this.chart?.destroy();
    this.chart = null;
    if (this.data?.length) this.renderChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private renderChart(): void {
    this.chart?.destroy();
    const options = {
      series: [
        { name: 'Interactions', data: this.data.map(d => d.interactions) },
        { name: 'Responses',    data: this.data.map(d => d.responses) }
      ],
      chart: {
        type: 'area',
        height: this.height,
        background: 'transparent',
        toolbar: { show: true },
        animations: { enabled: true, speed: 600 },
        zoom: { enabled: true }
      },
      colors: ['#c8f135', '#3B82F6'],
      stroke: { curve: 'smooth', width: [2, 2] },
      fill: {
        type: ['gradient', 'gradient'],
        gradient: {
          shade: 'dark',
          type: 'vertical',
          opacityFrom: [0.35, 0.2],
          opacityTo:   [0.05, 0.02]
        }
      },
      markers: {
        size: 3,
        strokeColors: ['#0a0a0a', '#0a0a0a'],
        strokeWidth: 2,
        hover: { size: 5 }
      },
      xaxis: {
        categories: this.data.map(d => d.date),
        labels: {
          style: { colors: '#9ca3af', fontSize: '11px' },
          rotate: -30,
          rotateAlways: false,
          hideOverlappingLabels: true
        },
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: { labels: { style: { colors: '#9ca3af', fontSize: '11px' } } },
      grid: { borderColor: '#1f2937', strokeDashArray: 4 },
      tooltip: { theme: 'dark', shared: true, intersect: false },
      dataLabels: { enabled: false },
      legend: { show: false }
    };
    this.chart = new ApexCharts(this.chartEl.nativeElement, options);
    this.chart.render();
  }
}
