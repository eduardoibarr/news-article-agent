export interface RawArticle {
  event: string;
  value: {
    url: string;
  };
}

export interface CleanedArticle {
  title: string;
  content: string;
  url: string;
  date: string;
}

export interface Source {
  title: string;
  url: string;
  date: string;
}

export interface AgentResponse {
  answer: string;
  sources: Source[];
}
