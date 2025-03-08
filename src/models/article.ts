export interface RawArticle {
  event: string;
  value: {
    url: string;
  };
}

export interface CleanedArticle {
  id: string;
  title: string;
  content: string;
  url: string;
  date?: string;
  summary?: string;
  publishedAt?: string;
  source?: string;
  createdAt?: string;
}

export interface Source {
  id: string;
  title?: string;
  url: string;
  date?: string;
  content?: string;
  summary?: string;
  source?: string;
  publishedAt?: string;
  createdAt?: string;
}

export interface AgentResponse {
  answer: string;
  sources: Source[];
}
