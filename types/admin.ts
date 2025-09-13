export type LogRow = {
  id: string;
  date?: string;
  timestamp?: string;
  user?: string[];
  machine?: string[];
  siteName?: string;
  work?: number;
  workDescription?: string;
  type?: 'IN' | 'OUT';
};

export type SearchResponse = {
  items: LogRow[];
  nextPageToken?: string;
};
