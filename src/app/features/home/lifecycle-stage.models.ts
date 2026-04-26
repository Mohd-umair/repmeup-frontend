export type LifecycleStage = 'acquire' | 'convert' | 'support' | 'retain' | 'repeat';

export interface LifecycleStageData {
  label: string;
  icon: string;
  title: string;
  summary: string;
  features: { title: string; description: string }[];
  highlightStat: string;
  highlightLabel: string;
}
