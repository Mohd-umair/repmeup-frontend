/**
 * Lazy, cached loader for ApexCharts.
 *
 * ApexCharts is ~130 KB (gzipped) and was previously pulled into the initial
 * bundle via a static `import ApexCharts from 'apexcharts'` in every chart
 * component. Those components are reached from eagerly-loaded pages (dashboard),
 * so the whole library shipped on first load even for users who never see a chart.
 *
 * This loader imports the library on demand and caches the promise so it is
 * fetched/parsed at most once across the whole app.
 */
let cached: Promise<any> | null = null;

export function loadApexCharts(): Promise<any> {
  if (!cached) {
    cached = import('apexcharts').then((m: any) => m.default ?? m);
  }
  return cached;
}
