import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { McpServer, McpTool, McpResource, McpResourceTemplate } from '../../types/mcp';
import { McpProtocol } from './protocol';

export class McpHub extends EventEmitter {
  private servers: Map<string, {
    process: ChildProcess | null;
    protocol: McpProtocol | null;
    config: McpServer;
    tools: McpTool[];
    resources: McpResource[];
    resourceTemplates: McpResourceTemplate[];
    status: 'connected' | 'connecting' | 'disconnected';
    error?: string;
  }> = new Map();
  
  constructor() {
    super();
  }
  
  /**
   * Start all configured MCP servers
   */
  async startServers(configs: Record<string, McpServer>): Promise<void> {
    // Stop any running servers first
    for (const [name] of this.servers) {
      await this.stopServer(name);
    }
    
    // Start new servers
    for (const [name, config] of Object.entries(configs)) {
      if (!config.disabled) {
        try {
          await this.startServer(name, config);
        } catch (error) {
          console.error(`Failed to start MCP server ${name}:`, error);
          this.emit('server-error', name, error instanceof Error ? error.message : String(error));
        }
      }
    }
  }
  
  /**
   * Start a single MCP server
   */
  async startServer(name: string, config: McpServer): Promise<void> {
    // Skip if server is already running
    if (this.servers.has(name) && this.servers.get(name)!.status === 'connected') {
      return;
    }
    
    // Initialize server entry
    this.servers.set(name, {
      process: null,
      protocol: null,
      config,
      tools: [],
      resources: [],
      resourceTemplates: [],
      status: 'connecting'
    });
    
    this.emit('server-connecting', name);
    
    try {
      // Spawn process
      const childProcess = spawn(config.command, config.args || [], {
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      // Set up protocol
      const protocol = new McpProtocol(childProcess);
      
      // Update server entry
      const serverEntry = this.servers.get(name)!;
      serverEntry.process = childProcess;
      serverEntry.protocol = protocol;
      
      // Fetch capabilities
      try {
        // List tools
        const toolsResponse = await protocol.listTools();
        serverEntry.tools = toolsResponse.tools || [];
        
        // List resources
        const resourcesResponse = await protocol.listResources();
        serverEntry.resources = resourcesResponse.resources || [];
        
        // List resource templates
        const templatesResponse = await protocol.listResourceTemplates();
        serverEntry.resourceTemplates = templatesResponse.resourceTemplates || [];
        
        // Mark as connected
        serverEntry.status = 'connected';
        this.emit('server-connected', name);
      } catch (error) {
        console.error(`Failed to fetch capabilities for MCP server ${name}:`, error);
        serverEntry.status = 'disconnected';
        serverEntry.error = error instanceof Error ? error.message : String(error);
        this.emit('server-error', name, serverEntry.error);
        
        // Clean up process
        this.closeServerProcess(childProcess);
      }
      
      // Handle server exit
      protocol.on('exit', (code) => {
        const entry = this.servers.get(name);
        if (entry) {
          entry.status = 'disconnected';
          entry.process = null;
          entry.protocol = null;
          
          if (!entry.error) {
            entry.error = `Server process exited with code ${code}`;
          }
          
          this.emit('server-disconnected', name);
        }
      });
    } catch (error) {
      // Handle startup errors
      const serverEntry = this.servers.get(name)!;
      serverEntry.status = 'disconnected';
      serverEntry.error = error instanceof Error ? error.message : String(error);
      this.emit('server-error', name, serverEntry.error);
    }
  }
  
  /**
   * Stop a server
   */
  async stopServer(name: string): Promise<void> {
    const serverEntry = this.servers.get(name);
    if (!serverEntry) return;
    
    // Kill process if running
    if (serverEntry.process) {
      this.closeServerProcess(serverEntry.process);
    }
    
    // Update status
    serverEntry.status = 'disconnected';
    serverEntry.process = null;
    serverEntry.protocol = null;
    
    this.emit('server-disconnected', name);
  }
  
  /**
   * Execute a tool from an MCP server
   */
  async executeTool(serverName: string, toolName: string, args: any): Promise<any> {
    const serverEntry = this.servers.get(serverName);
    if (!serverEntry) {
      throw new Error(`MCP server ${serverName} not found`);
    }
    
    if (serverEntry.status !== 'connected' || !serverEntry.protocol) {
      throw new Error(`MCP server ${serverName} is not connected`);
    }
    
    // Check if tool exists
    const tool = serverEntry.tools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found in MCP server ${serverName}`);
    }
    
    // Execute tool
    return serverEntry.protocol.callTool(toolName, args);
  }
  
  /**
   * Access a resource from an MCP server
   */
  async accessResource(serverName: string, uri: string): Promise<any> {
    const serverEntry = this.servers.get(serverName);
    if (!serverEntry) {
      throw new Error(`MCP server ${serverName} not found`);
    }
    
    if (serverEntry.status !== 'connected' || !serverEntry.protocol) {
      throw new Error(`MCP server ${serverName} is not connected`);
    }
    
    // Execute resource request
    return serverEntry.protocol.readResource(uri);
  }
  
  /**
   * Get the status of a specific server
   */
  getServerStatus(name: string): 'connected' | 'connecting' | 'disconnected' | 'not-found' {
    const serverEntry = this.servers.get(name);
    if (!serverEntry) {
      return 'not-found';
    }
    return serverEntry.status;
  }
  
  /**
   * Get information about all servers
   */
  getAllServers(): Record<string, {
    status: 'connected' | 'connecting' | 'disconnected';
    error?: string;
    tools: McpTool[];
    resources: McpResource[];
    resourceTemplates: McpResourceTemplate[];
  }> {
    const result: Record<string, any> = {};
    
    for (const [name, serverEntry] of this.servers.entries()) {
      result[name] = {
        status: serverEntry.status,
        error: serverEntry.error,
        tools: serverEntry.tools,
        resources: serverEntry.resources,
        resourceTemplates: serverEntry.resourceTemplates
      };
    }
    
    return result;
  }
  
  /**
   * Get all available tools and resources
   */
  getAllToolsAndResources(): {
    tools: Array<{ serverName: string, tool: McpTool }>;
    resources: Array<{ serverName: string, resource: McpResource }>;
    resourceTemplates: Array<{ serverName: string, template: McpResourceTemplate }>;
  } {
    const tools: Array<{ serverName: string, tool: McpTool }> = [];
    const resources: Array<{ serverName: string, resource: McpResource }> = [];
    const resourceTemplates: Array<{ serverName: string, template: McpResourceTemplate }> = [];
    
    for (const [serverName, serverEntry] of this.servers.entries()) {
      if (serverEntry.status === 'connected') {
        for (const tool of serverEntry.tools) {
          tools.push({ serverName, tool });
        }
        
        for (const resource of serverEntry.resources) {
          resources.push({ serverName, resource });
        }
        
        for (const template of serverEntry.resourceTemplates) {
          resourceTemplates.push({ serverName, template });
        }
      }
    }
    
    return { tools, resources, resourceTemplates };
  }

  /**
   * Helper to properly close a server process
   */
  private closeServerProcess(process: ChildProcess): void {
    try {
      // Try to gracefully terminate
      if (process.stdin) {
        process.stdin.end();
      }
      
      // Give it a chance to shut down gracefully
      setTimeout(() => {
        if (!process.killed) {
          process.kill();
        }
      }, 500);
    } catch (error) {
      console.error('Error closing MCP server process:', error);
    }
  }
}
