import {
  Component, Input, OnChanges, OnDestroy, AfterViewInit,
  ElementRef, ViewChild, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import ApexCharts from 'apexcharts';
import { ISentimentBreakdown } from '../../../core/models/analytics.model';

@Component({
  selector: 'app-sentiment-donut-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div>
      <!-- Donut chart — show whenever we have sentimentData (with data or pending) -->
      <div #chartEl [class.hidden]="!showChart"></div>

      <!-- Caption when we have interactions but no classification yet -->
      <p *ngIf="showChart && hasPendingClassification"
         class="text-center text-sm text-gray-400 mt-3">
        Sentiment analysis runs automatically on incoming messages. No results yet for this period.
      </p>

      <!-- Only when no data object or zero interactions at all -->
      <div *ngIf="!showChart"
           class="flex flex-col items-center justify-center h-48 text-gray-500">
        <i class="fas fa-smile text-4xl mb-3 text-gray-700"></i>
        <p class="text-sm">No sentiment data available for this period</p>
      </div>
    </div>
  `
})
export class SentimentDonutChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('chartEl') chartEl!: ElementRef;
  @Input() sentimentData!: ISentimentBreakdown;
  @Input() height = 300;

  private chart: ApexCharts | null = null;
  private initialized = false;

  get classifiedTotal(): number {
    if (!this.sentimentData) return 0;
    return (
      (this.sentimentData.positive || 0) +
      (this.sentimentData.neutral  || 0) +
      (this.sentimentData.negative || 0)
    );
  }

  /** Show donut when we have the data object and either classified counts or pending interactions */
  get showChart(): boolean {
    if (!this.sentimentData) return false;
    const total = this.sentimentData.total ?? 0;
    return this.classifiedTotal > 0 || total > 0;
  }

  /** Interactions exist but none have sentiment labels yet */
  get hasPendingClassification(): boolean {
    return this.classifiedTotal === 0 && (this.sentimentData?.total ?? 0) > 0;
  }

  ngAfterViewInit(): void {
    this.initialized = true;
    if (this.showChart) this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.initialized || !changes['sentimentData']) return;
    this.chart?.destroy();
    this.chart = null;
    if (this.showChart) this.renderChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private renderChart(): void {
    this.chart?.destroy();
    const isPending = this.hasPendingClassification;
    const total = this.sentimentData.total ?? 0;

    if (isPending && total > 0) {
      // Single slice: "Pending analysis" so the donut is always visible
      const options = {
        series: [total],
        labels: ['Pending analysis'],
        colors: ['#6B7280'],
        chart: {
          type: 'donut',
          height: this.height,
          background: 'transparent',
          animations: { enabled: true, speed: 600 }
        },
        legend: { show: true, position: 'bottom', labels: { colors: '#d1d5db' } },
        dataLabels: {
          enabled: true,
          formatter: () => total.toLocaleString(),
          style: { colors: ['#fff'], fontSize: '12px', fontWeight: 600 }
        },
        plotOptions: {
          pie: {
            donut: {
              size: '65%',
              labels: {
                show: true,
                total: { show: true, label: 'Total', color: '#9ca3af', formatter: () => total.toLocaleString() }
              }
            }
          }
        },
        tooltip: { theme: 'dark', y: { formatter: (val: number) => val.toLocaleString() } }
      };
      this.chart = new ApexCharts(this.chartEl.nativeElement, options);
      this.chart.render();
      return;
    }

    // Normal 3-slice sentiment donut
    const classifiedTotal = this.classifiedTotal;
    const options = {
      series: [
        this.sentimentData.positive || 0,
        this.sentimentData.neutral  || 0,
        this.sentimentData.negative || 0
      ],
      labels: ['Positive', 'Neutral', 'Negative'],
      colors: ['#10B981', '#F59E0B', '#EF4444'],
      chart: {
        type: 'donut',
        height: this.height,
        background: 'transparent',
        animations: { enabled: true, speed: 600 }
      },
      legend: {
        show: true,
        position: 'bottom',
        labels: { colors: '#d1d5db' },
        fontSize: '13px'
      },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${val.toFixed(1)}%`,
        style: { colors: ['#fff'], fontSize: '12px', fontWeight: 600 }
      },
      plotOptions: {
        pie: {
          donut: {
            size: '65%',
            labels: {
              show: true,
              total: {
                show: true,
                label: 'Classified',
                color: '#9ca3af',
                formatter: () => classifiedTotal.toLocaleString()
              }
            }
          }
        }
      },
      tooltip: {
        theme: 'dark',
        y: { formatter: (val: number) => val.toLocaleString() }
      },
      responsive: [{ breakpoint: 480, options: { chart: { height: 260 } } }]
    };
    this.chart = new ApexCharts(this.chartEl.nativeElement, options);
    this.chart.render();
  }
}
