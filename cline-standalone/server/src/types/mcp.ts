export type McpMode = "full" | "server-use-only" | "off";

export interface McpServer {
  command: string;
  args: string[];
  env?: Record<string, string>;
  disabled?: boolean;
  timeout?: number;
  autoApprove?: string[];
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: object;
}

export interface McpResource {
  uri: string;
  name: string;
  mimeType?: string;
  description?: string;
}

export interface McpResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpToolCallResponse {
  _meta?: Record<string, any>;
  content: Array<
    | {
        type: "text";
        text: string;
      }
    | {
        type: "image";
        data: string;
        mimeType: string;
      }
    | {
        type: "resource";
        resource: {
          uri: string;
          mimeType?: string;
          text?: string;
          blob?: string;
        };
      }
  >;
  isError?: boolean;
}

export interface McpResourceResponse {
  _meta?: Record<string, any>;
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  }>;
}
