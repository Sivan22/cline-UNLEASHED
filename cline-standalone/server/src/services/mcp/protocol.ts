import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

export class McpProtocol extends EventEmitter {
  private process: ChildProcess;
  private pendingRequests: Map<string, { 
    resolve: (value: any) => void, 
    reject: (reason: any) => void,
    timeoutId: NodeJS.Timeout
  }> = new Map();
  private defaultTimeout: number = 60000; // 60 seconds
  
  constructor(process: ChildProcess) {
    super();
    this.process = process;
    this.setupCommunication();
  }
  
  private setupCommunication() {
    if (!this.process.stdout || !this.process.stderr) {
      throw new Error('Process does not have stdout or stderr');
    }
    
    this.process.stdout.on('data', (data) => {
      try {
        const messages = data.toString().trim().split('\n');
        
        for (const message of messages) {
          if (!message) continue;
          
          const parsedMessage = JSON.parse(message);
          
          if (parsedMessage.id && this.pendingRequests.has(parsedMessage.id)) {
            const { resolve, reject, timeoutId } = this.pendingRequests.get(parsedMessage.id)!;
            
            // Clear timeout
            clearTimeout(timeoutId);
            
            if (parsedMessage.error) {
              reject(new Error(parsedMessage.error.message || 'Unknown error'));
            } else {
              resolve(parsedMessage.result);
            }
            
            this.pendingRequests.delete(parsedMessage.id);
          } else {
            this.emit('message', parsedMessage);
          }
        }
      } catch (error) {
        console.error('Error parsing MCP message:', error);
      }
    });
    
    this.process.stderr.on('data', (data) => {
      console.error(`MCP server error: ${data}`);
    });
    
    // Handle process exit
    this.process.on('exit', (code) => {
      // Reject all pending requests
      for (const [id, { reject, timeoutId }] of this.pendingRequests.entries()) {
        clearTimeout(timeoutId);
        reject(new Error(`MCP server process exited with code ${code}`));
        this.pendingRequests.delete(id);
      }
      
      this.emit('exit', code);
    });
  }
  
  async sendRequest(method: string, params: any, timeout?: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };
      
      // Set up timeout
      const timeoutMs = timeout || this.defaultTimeout;
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          reject(new Error(`Request timed out after ${timeoutMs}ms`));
          this.pendingRequests.delete(id);
        }
      }, timeoutMs);
      
      this.pendingRequests.set(id, { resolve, reject, timeoutId });
      
      // Send request
      if (!this.process.stdin) {
        reject(new Error('Process does not have stdin'));
        return;
      }
      
      this.process.stdin.write(JSON.stringify(request) + '\n');
    });
  }
  
  // MCP operation methods
  async listTools(): Promise<{ tools: any[] }> {
    return this.sendRequest('listTools', {});
  }
  
  async callTool(name: string, arguments_: any): Promise<any> {
    return this.sendRequest('callTool', { name, arguments: arguments_ });
  }
  
  async listResources(): Promise<{ resources: any[] }> {
    return this.sendRequest('listResources', {});
  }
  
  async listResourceTemplates(): Promise<{ resourceTemplates: any[] }> {
    return this.sendRequest('listResourceTemplates', {});
  }
  
  async readResource(uri: string): Promise<any> {
    return this.sendRequest('readResource', { uri });
  }
}
