export interface ToolContent {
  type: 'text';
  text: string;
}

export interface ToolResult {
  content: ToolContent[];
  details: Record<string, unknown>;
  isError?: boolean;
}

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}
