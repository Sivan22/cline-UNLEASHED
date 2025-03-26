export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string | ContentBlock[];
  timestamp: number;
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'image';
  content: string;
  id?: string;
  tool_name?: string;
  tool_params?: Record<string, any>;
}

export interface ApiConfiguration {
  apiProvider: string;
  apiModelId: string;
  apiKey: string;
  [key: string]: any;
}

export interface TaskHistory {
  id: string;
  timestamp: number;
  task: string;
  messages?: Message[];
}

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface SearchResult {
  path: string;
  line: number;
  content: string;
  context: string[];
}
