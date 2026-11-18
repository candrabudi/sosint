// Mock data — nanti diganti dengan data dari API.

export const kpis = [
  { label: 'Traffic', value: '982', delta: '+5%', up: true },
  { label: 'ROI', value: '+15%', delta: '+3%', up: true },
  { label: 'Conversions', value: '473', delta: '+9%', up: true },
  { label: 'Expenses', value: '$884', delta: '-2%', up: false },
  { label: 'CTR', value: '2.5%', delta: '-0.2%', up: false },
  { label: 'CPA', value: '$5.41', delta: '-$0.34', up: false },
];

// Seeded random walk supaya grafik stabil setiap render
function walk(seed: number, n: number, drift = 0, vol = 1.6, start = 0) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647) - 0.5;
  const out: number[] = [];
  let v = start;
  for (let i = 0; i < n; i++) {
    v += rand() * vol + drift - v * 0.06;
    out.push(Math.max(-9.5, Math.min(9.5, v)));
  }
  return out;
}

export const TREND_DAYS = 92; // 1 Jun – 31 Agu
const startDate = new Date(2026, 5, 1);
export const trendDates = Array.from({ length: TREND_DAYS }, (_, i) => {
  const d = new Date(startDate);
  d.setDate(d.getDate() + i);
  return d;
});

export const trends = {
  traffic: walk(11, TREND_DAYS, 0.08, 4.2, 1),
  roi: walk(97, TREND_DAYS, 0.04, 2.8, -1),
  conversions: walk(53, TREND_DAYS, -0.02, 2.2, 0),
};

export type LeadQuality = 'NEEDS REVIEW' | 'GOOD' | 'NEUTRAL';

export interface Lead {
  id: number;
  date: string;
  fresh?: boolean;
  company?: string;
  email: string;
  quality: LeadQuality;
  country: string;
  hasNote?: boolean;
  group: number;
  detail?: {
    services: string[];
    referrer: string;
    referrerNote: string;
    revenue: string;
    score: number;
    note: string;
  };
}

export const leads: Lead[] = [
  { id: 1, group: 0, date: 'Today, 14:12', fresh: true, email: 'contact@helpdesk.com', quality: 'NEEDS REVIEW', country: 'USA' },
  { id: 2, group: 0, date: 'Today, 8:34', fresh: true, company: 'Innovate.co', email: 's.chen@innovate.co', quality: 'NEEDS REVIEW', country: 'Canada' },
  { id: 3, group: 1, date: 'Aug 4, 17:57', company: 'Webmail', email: 'maria.g@webmail.net', quality: 'GOOD', country: 'Germany', hasNote: true },
  { id: 4, group: 1, date: 'Aug 4, 13:40', email: 'john.doe@startup.org', quality: 'GOOD', country: 'Australia' },
  {
    id: 5, group: 2, date: 'Aug 3, 10:22', company: 'Designhub', email: 'contact@designhub.io', quality: 'NEEDS REVIEW', country: 'UK',
    detail: {
      services: ['UI/UX Design', 'Web Dev'],
      referrer: 'Google Ads',
      referrerNote: 'Summer Sale Campaign',
      revenue: '$1,500',
      score: 85,
      note: 'Aug 3, 15:17',
    },
  },
  { id: 6, group: 2, date: 'Aug 3, 9:01', company: 'Proton', email: 'a.kowalski@proton.me', quality: 'NEUTRAL', country: 'USA', hasNote: true },
  { id: 7, group: 3, date: 'Aug 2, 20:32', email: 'assistance@service.net', quality: 'NEEDS REVIEW', country: 'Japan', hasNote: true },
  { id: 8, group: 3, date: 'Aug 2, 11:54', email: 'info@braziltech.com.br', quality: 'NEUTRAL', country: 'Brazil' },
];

export const instagram = {
  followers: { value: '135,145', delta: '+16' },
  interactions: { value: '1,356', delta: '+7', ratio: 0.72 },
  stats: [
    ['Likes', '697'],
    ['Comments', '22'],
    ['Saves', '566'],
    ['Shares', '71'],
  ] as const,
  posts: [
    { date: 'JUL 30', from: '#2b2d31', to: '#9bd334' },
    { date: 'AUG 1', from: '#3a5fae', to: '#e8edf7' },
    { date: 'JUL 31', from: '#18191c', to: '#7a4fd1' },
    { date: 'AUG 3', from: '#0d1b3d', to: '#5b8be0' },
  ],
};

export const xcom = {
  followers: { value: '45,015', delta: '+7' },
  bars: [
    { day: '27', v: 0.55 },
    { day: '28', v: 0.25 },
    { day: '29', v: 0.45 },
    { day: '30', v: 0.35 },
    { day: '31', v: 0.95 },
    { day: '1', v: 0.25 },
    { day: '2', v: 0.45 },
  ],
  stats: [
    ['Impressions', '933', '-57%'],
    ['Engagement Rate', '15.8%', '+82%'],
    ['Engagement', '148', '+22%'],
  ] as const,
};
