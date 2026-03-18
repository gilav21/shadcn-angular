export interface Framework {
  value: string;
  label: string;
}

export interface Payment {
  id: string;
  amount: number;
  status: 'pending' | 'processing' | 'success' | 'failed';
  email: string;
  clientName?: string;
  role?: string;
}

export interface OrgNode {
  id: string;
  name: string;
  role: string;
  headcount: number;
  budget: number;
  children?: OrgNode[];
}

export interface OpsTicketTimelineEvent {
  at: string;
  actor: string;
  note: string;
}

export interface OpsTicket {
  id: string;
  account: string;
  service: string;
  region: 'NA' | 'EU' | 'APAC' | 'LATAM';
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  status: 'Open' | 'Investigating' | 'Mitigated' | 'Resolved';
  owner: string;
  mrr: number;
  slaMinutes: number;
  createdAt: string;
  updatedAt: string;
  summary: string;
  tags: string[];
  timeline: OpsTicketTimelineEvent[];
}

export interface VirtualScrollItem {
  id: number;
  title: string;
  description: string;
  height: number;
  type: string;
  color: string;
  author?: string;
  avatar?: string;
  timestamp?: string;
  likes?: number;
  comments?: number;
  shares?: number;
  paragraphs?: string[];
  images?: { url: string; caption: string }[];
  tags?: string[];
  subItems?: { id: number; name: string }[];
  imageSize?: string;
  chartData?: { month: string; value: number }[];
  expandedContent?: string;
}
