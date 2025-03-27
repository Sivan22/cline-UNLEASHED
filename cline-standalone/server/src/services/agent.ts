import { Anthropic } from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { spawn, ChildProcess } from 'child_process';
import { parseAssistantMessage, AssistantMessageContent, ToolUse } from './assistant-message';
import { McpHub, McpConfigManager } from './mcp';
import { McpTool, McpResource, McpResourceTemplate } from '../types/mcp';

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
}

/**
 * Core service that handles agent functionality, similar to the Cline class in VSCode extension
 */
export class AgentService {
  private anthropic: Anthropic;
  private conversationHistory: Anthropic.MessageParam[] = [];
  private config: ApiConfiguration;
  private workingDirectory: string;
  private callbacks: {
    onText?: (text: string, partial: boolean) => void;
    onToolUse?: (toolUse: ToolUse) => void;
    onToolResult?: (result: string) => void;
    onComplete?: () => void;
  } = {};
  
  // MCP related properties
  private mcpHub: McpHub;
  private mcpConfigManager: McpConfigManager;
  
  constructor(workingDirectory: string = process.cwd()) {
    // Initialize with default values, will be updated when client sets API key
    this.anthropic = new Anthropic({
      apiKey: 'dummy-key', // Will be replaced with real key from client
    });
    this.config = {
      apiProvider: 'anthropic',
      apiModelId: 'claude-3-sonnet-20240229',
      apiKey: 'dummy-key'
    };
    this.workingDirectory = workingDirectory;
    
    // Initialize MCP components
    this.mcpConfigManager = new McpConfigManager(
      path.join(process.cwd(), 'config', 'mcp-settings.json')
    );
    this.mcpHub = new McpHub();
    
    // Initialize MCP servers
    this.initializeMcpServers();
  }
  
  /**
   * Initialize MCP servers from configuration
   */
  private async initializeMcpServers(): Promise<void> {
    try {
      const configs = await this.mcpConfigManager.loadConfig();
      await this.mcpHub.startServers(configs);
    } catch (error) {
      console.error('Failed to initialize MCP servers:', error);
    }
  }
  
  /**
   * Update API configuration for this agent
   */
  public updateConfig(config: ApiConfiguration) {
    this.config = config;
    
    if (config.apiProvider === 'anthropic') {
      this.anthropic = new Anthropic({
        apiKey: config.apiKey,
      });
    }
    // Add other providers as needed
  }

  /**
   * Set callbacks for streaming updates
   */
  public setCallbacks(callbacks: {
    onText?: (text: string, partial: boolean) => void;
    onToolUse?: (toolUse: ToolUse) => void;
    onToolResult?: (result: string) => void;
    onComplete?: () => void;
  }) {
    this.callbacks = callbacks;
  }
  
  /**
   * Process a message from the client and generate a response
   */
  public async processMessage(message: Message): Promise<Message> {
    // Convert to format expected by API
    // Anthropic only accepts 'user' or 'assistant' roles, so map 'system' to 'user'
    const role = message.role === 'system' ? 'user' : message.role;
    
    if (typeof message.content === 'string') {
      // Add the message to conversation history
      this.conversationHistory.push({
        role: role as 'user' | 'assistant',
        content: message.content
      });
    } else {
      // For more complex content with tool results
      this.conversationHistory.push({
        role: role as 'user' | 'assistant',
        content: message.content.map(block => {
          if (block.type === 'text') {
            return { type: 'text', text: block.content };
          } else if (block.type === 'image') {
            return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: block.content } };
          }
          // Tool results would be converted to text
          return { type: 'text', text: block.content };
        })
      });
    }
    
    try {
      // Create system prompt
      const systemPrompt = this.generateSystemPrompt();
      
      // Stream response from Claude
      const response = await this.anthropic.messages.create({
        model: this.config.apiModelId,
        max_tokens: 4000,
        system: systemPrompt,
        messages: this.conversationHistory,
        stream: true
      });

      let assistantMessage = '';
      let contentBlocks: AssistantMessageContent[] = [];
      let lastContentBlocksLength = 0;
      
      // Process streaming response
      for await (const chunk of response) {
        // Handle different chunk types from the stream
        if (chunk.type === 'content_block_delta') {
          // Handle text content safely, regardless of delta structure
          const deltaText = this.extractTextFromStreamChunk(chunk);
          if (deltaText) {
            assistantMessage += deltaText;
            
            // Parse assistant message into content blocks
            contentBlocks = parseAssistantMessage(assistantMessage);
            
            // If we have new content blocks, process them
            if (contentBlocks.length > lastContentBlocksLength) {
              const newBlocks = contentBlocks.slice(lastContentBlocksLength);
              
              for (const block of newBlocks) {
                if (block.type === 'text') {
                  if (this.callbacks.onText) {
                    this.callbacks.onText(block.content, block.partial);
                  }
                } else if (block.type === 'tool_use' && !block.partial) {
                  if (this.callbacks.onToolUse) {
                    this.callbacks.onToolUse(block);
                  }
                  
                  // Execute tool and get result
                  const result = await this.executeTool(block);
                  
                  if (this.callbacks.onToolResult) {
                    this.callbacks.onToolResult(result);
                  }
                }
              }
              
              lastContentBlocksLength = contentBlocks.length;
            }
          }
        }
      }
      
      // Create a response message
      const responseMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: this.convertContentBlocksToResponseFormat(contentBlocks),
        timestamp: Date.now(),
      };
      
      // Add response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: [{ type: 'text', text: assistantMessage }]
      });

      if (this.callbacks.onComplete) {
        this.callbacks.onComplete();
      }
      
      return responseMessage;
    } catch (error) {
      console.error('Error calling LLM API:', error);
      return {
        id: uuidv4(),
        role: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        timestamp: Date.now(),
      };
    }
  }
  
  /**
   * Clear the conversation history
   */
  public clearConversation(): void {
    this.conversationHistory = [];
  }
  
  /**
   * Generate system prompt
   */
  private generateSystemPrompt(): string {
    // Get all MCP tools and resources
    const { tools, resources, resourceTemplates } = this.mcpHub.getAllToolsAndResources();
    
    // Build MCP tools section
    let mcpToolsSection = '';
    
    if (tools.length > 0) {
      mcpToolsSection += '\n\n# Connected MCP Servers\n\n';
      
      // Group tools by server
      const serverTools: Record<string, McpTool[]> = {};
      for (const { serverName, tool } of tools) {
        if (!serverTools[serverName]) {
          serverTools[serverName] = [];
        }
        serverTools[serverName].push(tool);
      }
      
      // Format tools for each server
      for (const [serverName, serverToolList] of Object.entries(serverTools)) {
        mcpToolsSection += `## ${serverName}\n\n`;
        
        for (const tool of serverToolList) {
          mcpToolsSection += `### ${tool.name}\n`;
          if (tool.description) {
            mcpToolsSection += `${tool.description}\n`;
          }
          mcpToolsSection += '\n';
        }
      }
    }
    
    const basePrompt = `You are Cline, a highly skilled software engineer with extensive knowledge in many programming languages, frameworks, design patterns, and best practices.

You have access to a set of tools that are executed upon the user's approval. You can use one tool per message, and will receive the result of that tool use in the user's response. You use tools step-by-step to accomplish a given task, with each tool use informed by the result of the previous tool use.

# Tool Use Formatting

Tool use is formatted using XML-style tags. The tool name is enclosed in opening and closing tags, and each parameter is similarly enclosed within its own set of tags. Here's the structure:

<tool_name>
<parameter1_name>value1</parameter1_name>
<parameter2_name>value2</parameter2_name>
...
</tool_name>

# Tools

## execute_command
Description: Request to execute a CLI command on the system.
Parameters:
- command: (required) The CLI command to execute.
- requires_approval: (required) A boolean indicating whether this command requires explicit user approval before execution.

## read_file
Description: Request to read the contents of a file at the specified path.
Parameters:
- path: (required) The path of the file to read

## write_to_file
Description: Request to write content to a file at the specified path.
Parameters:
- path: (required) The path of the file to write to
- content: (required) The content to write to the file

## replace_in_file
Description: Request to replace sections of content in an existing file using SEARCH/REPLACE blocks.
Parameters:
- path: (required) The path of the file to modify
- diff: (required) One or more SEARCH/REPLACE blocks

## search_files
Description: Request to perform a regex search across files in a specified directory.
Parameters:
- path: (required) The path of the directory to search in
- regex: (required) The regular expression pattern to search for
- file_pattern: (optional) Glob pattern to filter files

## list_files
Description: Request to list files and directories within the specified directory.
Parameters:
- path: (required) The path of the directory to list contents for
- recursive: (optional) Whether to list files recursively.

## use_mcp_tool
Description: Request to use a tool provided by a connected MCP server. Each MCP server can provide multiple tools with different capabilities.
Parameters:
- server_name: (required) The name of the MCP server providing the tool
- tool_name: (required) The name of the tool to execute
- arguments: (required) A JSON object containing the tool's input parameters, following the tool's input schema

## access_mcp_resource
Description: Request to access a resource provided by a connected MCP server. Resources represent data sources that can be used as context.
Parameters:
- server_name: (required) The name of the MCP server providing the resource
- uri: (required) The URI identifying the specific resource to access

## ask_followup_question
Description: Ask the user a question to gather additional information needed to complete the task.
Parameters:
- question: (required) The question to ask the user
- options: (optional) An array of 2-5 options for the user to choose from

## attempt_completion
Description: Present the result of your work to the user.
Parameters:
- result: (required) The result of the task
- command: (optional) A CLI command to execute to show a live demo of the result to the user

${mcpToolsSection}

Your current working directory is: ${this.workingDirectory}`;

    return basePrompt;
  }
  
  /**
   * Execute a tool based on the tool use block
   */
  private async executeTool(toolUse: ToolUse): Promise<string> {
    switch (toolUse.name) {
      case 'read_file':
        return this.executeReadFileTool(toolUse.params.path as string);
      
      case 'write_to_file':
        return this.executeWriteToFileTool(
          toolUse.params.path as string,
          toolUse.params.content as string
        );
      
      case 'list_files':
        return this.executeListFilesTool(
          toolUse.params.path as string, 
          toolUse.params.recursive === 'true'
        );
        
      case 'search_files':
        return this.executeSearchFilesTool(
          toolUse.params.path as string,
          toolUse.params.regex as string,
          toolUse.params.file_pattern
        );
        
      case 'execute_command':
        return this.executeCommandTool(
          toolUse.params.command as string
        );
        
      case 'replace_in_file':
        return this.executeReplaceInFileTool(
          toolUse.params.path as string,
          toolUse.params.diff as string
        );
      
      case 'use_mcp_tool': {
        const serverName = toolUse.params.server_name as string;
        const toolName = toolUse.params.tool_name as string;
        const argsJson = toolUse.params.arguments as string;
        
        try {
          // Parse arguments
          const args = JSON.parse(argsJson);
          
          // Execute tool
          const result = await this.mcpHub.executeTool(serverName, toolName, args);
          return `Tool execution result: ${JSON.stringify(result, null, 2)}`;
        } catch (error) {
          return `Error executing MCP tool: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
      
      case 'access_mcp_resource': {
        const serverName = toolUse.params.server_name as string;
        const uri = toolUse.params.uri as string;
        
        try {
          const result = await this.mcpHub.accessResource(serverName, uri);
          return `Resource content: ${JSON.stringify(result, null, 2)}`;
        } catch (error) {
          return `Error accessing MCP resource: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
        
      default:
        return `Tool ${toolUse.name} is not implemented yet.`;
    }
  }
  
  private async executeReadFileTool(filePath: string): Promise<string> {
    try {
      const absolutePath = path.resolve(this.workingDirectory, filePath);
      const content = await fs.readFile(absolutePath, 'utf8');
      return `Content of ${filePath}:\n\n${content}`;
    } catch (error) {
      return `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
  
  private async executeWriteToFileTool(filePath: string, content: string): Promise<string> {
    try {
      const absolutePath = path.resolve(this.workingDirectory, filePath);
      
      // Ensure directory exists
      const directory = path.dirname(absolutePath);
      await fs.mkdir(directory, { recursive: true });
      
      await fs.writeFile(absolutePath, content);
      return `File successfully written to ${filePath}`;
    } catch (error) {
      return `Error writing file: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
  
  private async executeListFilesTool(dirPath: string, recursive: boolean): Promise<string> {
    try {
      const absolutePath = path.resolve(this.workingDirectory, dirPath);
      const entries = await this.listFiles(absolutePath, recursive);
      return `Files in ${dirPath}${recursive ? ' (recursive)' : ''}:\n\n${entries.join('\n')}`;
    } catch (error) {
      return `Error listing files: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
  
  private async listFiles(dirPath: string, recursive = false): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      let files: string[] = [];
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(this.workingDirectory, fullPath);
        
        if (entry.isDirectory() && recursive) {
          const nestedFiles = await this.listFiles(fullPath, recursive);
          files = [...files, ...nestedFiles];
        } else {
          files.push(entry.isDirectory() ? `${relativePath}/` : relativePath);
        }
      }
      
      return files;
    } catch (error) {
      console.error(`Error listing files in ${dirPath}:`, error);
      throw error;
    }
  }
  
  private async executeSearchFilesTool(dirPath: string, pattern: string, filePattern?: string): Promise<string> {
    try {
      const absolutePath = path.resolve(this.workingDirectory, dirPath);
      
      // This is a simplified implementation
      const results: any[] = [];
      const files = await this.listFiles(absolutePath, true);
      
      const regex = new RegExp(pattern, 'g');
      
      for (const file of files) {
        try {
          // Skip directories
          if (file.endsWith('/')) continue;
          
          // Skip if file doesn't match pattern
          if (filePattern && !this.matchesPattern(file, filePattern)) continue;
          
          const content = await fs.readFile(path.resolve(this.workingDirectory, file), 'utf8');
          const lines = content.split('\n');
          
          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              results.push({
                path: file,
                line: i + 1,
                content: lines[i],
                context: lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 3)).join('\n')
              });
            }
            // Reset regex state
            regex.lastIndex = 0;
          }
        } catch (error) {
          console.error(`Error searching in file ${file}:`, error);
          // Continue with other files
        }
      }
      
      if (results.length === 0) {
        return `No matches found for pattern ${pattern} in ${dirPath}`;
      }
      
      return `Search results for pattern ${pattern} in ${dirPath}:\n\n${results.map(result => (
        `File: ${result.path}\nLine ${result.line}: ${result.content}\nContext:\n${result.context}\n`
      )).join('\n')}`;
    } catch (error) {
      return `Error searching files: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
  
  private matchesPattern(filePath: string, pattern: string): boolean {
    // This is a simplified glob matcher
    // In a real implementation, use a proper glob matching library
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
      
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }
  
  private async executeCommandTool(command: string): Promise<string> {
    return new Promise((resolve) => {
      const process = spawn(command, [], { 
        shell: true,
        cwd: this.workingDirectory,
        stdio: 'pipe'
      });
      
      let output = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        output += data.toString();
      });
      
      process.on('close', (code) => {
        resolve(`Command executed with exit code: ${code}\n\nOutput:\n${output}`);
      });
    });
  }
  
  private async executeReplaceInFileTool(filePath: string, diff: string): Promise<string> {
    try {
      const absolutePath = path.resolve(this.workingDirectory, filePath);
      
      // Read the original file
      const originalContent = await fs.readFile(absolutePath, 'utf8');
      
      // Apply the diff
      const newContent = this.applyDiff(originalContent, diff);
      
      // Write the modified content back to the file
      await fs.writeFile(absolutePath, newContent);
      
      return `File ${filePath} successfully updated`;
    } catch (error) {
      return `Error replacing in file: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
  
  private applyDiff(originalContent: string, diff: string): string {
    let newContent = originalContent;
    
    // Extract SEARCH/REPLACE blocks
    const regex = /<<<<<<< SEARCH\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> REPLACE/g;
    let match;
    
    while ((match = regex.exec(diff)) !== null) {
      const searchContent = match[1];
      const replaceContent = match[2];
      
      // Replace the first occurrence
      newContent = newContent.replace(searchContent, replaceContent);
    }
    
    return newContent;
  }
  
  /**
   * Convert internal content blocks to the format expected by the client
   */
  /**
   * Safely extract text from different types of stream chunks
   */
  private extractTextFromStreamChunk(chunk: any): string | undefined {
    // Handle different delta types
    if (chunk.delta && typeof chunk.delta === 'object') {
      // Handle text delta
      if (chunk.delta.type === 'text_delta') {
        return chunk.delta.text;
      }
      
      // Handle regular text content
      if (chunk.delta.type === 'text' && chunk.delta.text) {
        return chunk.delta.text;
      }
      
      // Handle thinking delta
      if (chunk.delta.type === 'thinking_delta') {
        return chunk.delta.thinking;
      }
    }
    
    return undefined;
  }
  
  private convertContentBlocksToResponseFormat(blocks: AssistantMessageContent[]): ContentBlock[] {
    return blocks.map(block => {
      if (block.type === 'text') {
        return {
          type: 'text',
          content: block.content
        };
      } else {
        return {
          type: 'tool_use',
          tool_name: block.name,
          tool_params: block.params,
          content: JSON.stringify(block.params)
        };
      }
    });
  }
}
