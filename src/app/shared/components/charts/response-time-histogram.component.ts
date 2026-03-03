import {
  Component, Input, OnChanges, OnDestroy, AfterViewInit,
  ElementRef, ViewChild, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import ApexCharts from 'apexcharts';
import { IResponseTimeMetrics } from '../../../core/models/analytics.model';

@Component({
  selector: 'app-response-time-histogram',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div>
      <!-- Chart element — hidden via CSS so @ViewChild stays alive -->
      <div #chartEl [class.hidden]="!hasData"></div>

      <div *ngIf="!hasData"
           class="flex flex-col items-center justify-center h-48 text-gray-500">
        <i class="fas fa-stopwatch text-4xl mb-3 text-gray-700"></i>
        <p class="text-sm font-medium mb-1">No response time data</p>
        <p class="text-xs text-gray-600 text-center px-4">
          Start replying to messages to see your response time performance here.
        </p>
      </div>
    </div>
  `
})
export class ResponseTimeHistogramComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('chartEl') chartEl!: ElementRef;
  @Input() metrics!: IResponseTimeMetrics;
  @Input() height = 280;

  private chart: ApexCharts | null = null;
  private initialized = false;

  get hasData(): boolean {
    if (!this.metrics) return false;
    return (
      (this.metrics.within1Hour  || 0) +
      (this.metrics.within24Hours || 0) +
      (this.metrics.over24Hours  || 0)
    ) > 0;
  }

  ngAfterViewInit(): void {
    this.initialized = true;
    if (this.hasData) this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.initialized || !changes['metrics']) return;
    this.chart?.destroy();
    this.chart = null;
    if (this.hasData) this.renderChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private renderChart(): void {
    this.chart?.destroy();
    const annotations: any = {};
    if (this.metrics.avg) {
      annotations.yaxis = [{
        y: this.metrics.avg,
        borderColor: '#F59E0B',
        strokeDashArray: 4,
        label: {
          borderColor: '#F59E0B',
          style: { color: '#0a0a0a', background: '#F59E0B', fontWeight: 700 },
          text: `Avg: ${Math.round(this.metrics.avg)}m`
        }
      }];
    }
    const options = {
      series: [{
        name: 'Interactions',
        data: [
          this.metrics.within1Hour  || 0,
          this.metrics.within24Hours || 0,
          this.metrics.over24Hours  || 0
        ]
      }],
      chart: {
        type: 'bar',
        height: this.height,
        background: 'transparent',
        toolbar: { show: false },
        animations: { enabled: true, speed: 600 }
      },
      colors: ['#c8f135', '#3B82F6', '#EF4444'],
      xaxis: {
        categories: ['< 1 Hour', '1–24 Hours', '> 24 Hours'],
        labels: { style: { colors: '#9ca3af' } }
      },
      yaxis: { labels: { style: { colors: '#9ca3af' } } },
      plotOptions: { bar: { distributed: true, borderRadius: 6, columnWidth: '45%' } },
      dataLabels: {
        enabled: true,
        style: { colors: ['#0a0a0a'], fontSize: '12px', fontWeight: 700 }
      },
      grid: { borderColor: '#1f2937', strokeDashArray: 4 },
      annotations,
      legend: { show: false },
      tooltip: {
        theme: 'dark',
        y: { formatter: (val: number) => `${val.toLocaleString()} interactions` }
      }
    };
    this.chart = new ApexCharts(this.chartEl.nativeElement, options);
    this.chart.render();
  }
}
