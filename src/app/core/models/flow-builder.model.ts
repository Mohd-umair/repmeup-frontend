export type FlowChannel = 'whatsapp' | 'instagram' | 'facebook';
export type FlowStatus = 'draft' | 'active' | 'paused' | 'archived';
export type NodeCategory = 'trigger' | 'action' | 'condition' | 'wait' | 'control';

export interface IFlowNodePosition {
  x: number;
  y: number;
}

export interface IFlowNode {
  id: string;
  type: string;
  label?: string;
  position: IFlowNodePosition;
  config: Record<string, unknown>;
  supportedChannels?: FlowChannel[];
}

export interface IFlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: Record<string, unknown> | null;
}

export interface IFlowSettings {
  quietHoursStart?: string;
  quietHoursEnd?: string;
  frequencyCap?: number;
  frequencyCapWindowDays?: number;
  timezone?: string;
}

export interface IAutomationFlow {
  _id?: string;
  name: string;
  description?: string;
  channels: FlowChannel[];
  status?: FlowStatus;
  version?: number;
  entryNodeId?: string;
  nodes: IFlowNode[];
  edges: IFlowEdge[];
  settings?: IFlowSettings;
  stats?: {
    triggered: number;
    completed: number;
    converted: number;
    failed: number;
  };
  isBlueprint?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface IFlowNodeCatalogItem {
  type: string;
  category: NodeCategory;
  label: string;
  icon: string;
  description: string;
  supportedChannels: FlowChannel[];
  configFields: Array<{
    key: string;
    type: string;
    label: string;
    required?: boolean;
    options?: string[];
    default?: unknown;
    hint?: string;
  }>;
  defaultConfig?: Record<string, unknown>;
}

export interface IFlowValidationResult {
  valid: boolean;
  errors: Array<{
    code: string;
    message: string;
    nodeId?: string;
    edgeId?: string;
    field?: string;
    nodeIds?: string[];
  }>;
}
