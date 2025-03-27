import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Mock MCP server implementation for testing
 * This server implements the Model Context Protocol and can be used to test MCP client functionality
 */
export class MockMcpServer {
  // Server characteristics to simulate different behaviors
  private delay: number = 0;
  private failRequests: boolean = false;
  private shouldTimeout: boolean = false;
  private shouldCrash: boolean = false;
  
  // Mock tools and resources to return
  private tools: any[] = [
    {
      name: 'test_tool',
      description: 'A test tool for testing',
      inputSchema: {
        type: 'object',
        properties: {
          param1: { type: 'string' },
          param2: { type: 'number' }
        },
        required: ['param1']
      }
    }
  ];
  
  private resources: any[] = [
    {
      uri: 'test://resource1',
      name: 'Test Resource 1',
      mimeType: 'application/json'
    }
  ];
  
  private resourceTemplates: any[] = [
    {
      uriTemplate: 'test://{param}/data',
      name: 'Test Template',
      mimeType: 'application/json'
    }
  ];
  
  // Methods to configure mock behavior
  setDelay(ms: number) { this.delay = ms; }
  setFailRequests(shouldFail: boolean) { this.failRequests = shouldFail; }
  setTimeout(shouldTimeout: boolean) { this.shouldTimeout = shouldTimeout; }
  setCrash(shouldCrash: boolean) { this.shouldCrash = shouldCrash; }
  
  /**
   * Creates a real child process that runs this mock server
   * Used for integration testing with actual process spawning
   */
  static spawnMockServer(options: {
    delay?: number;
    failRequests?: boolean;
    timeout?: boolean;
    crash?: boolean;
  } = {}): ChildProcess {
    // Create temporary directory for the script if needed
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const scriptPath = path.join(tempDir, 'mock-mcp-server-runner.js');
    
    // Create a script that runs a standalone version of this mock server
    const scriptContent = `
      const { MockMcpServer } = require('./mock-mcp-server');
      const server = new MockMcpServer();
      
      // Configure server behavior based on options
      ${options.delay ? `server.setDelay(${options.delay});` : ''}
      ${options.failRequests ? 'server.setFailRequests(true);' : ''}
      ${options.timeout ? 'server.setTimeout(true);' : ''}
      ${options.crash ? 'server.setCrash(true);' : ''}
      
      server.start();
    `;
    
    fs.writeFileSync(scriptPath, scriptContent);
    
    // Return the child process
    return spawn('node', [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
  }
  
  /**
   * Start the mock server
   * This method sets up stdin/stdout communication using JSON-RPC
   */
  start() {
    // Handle JSON-RPC protocol over stdin/stdout
    process.stdin.on('data', async (data) => {
      try {
        // Parse incoming requests
        const requests = data.toString().trim().split('\n');
        
        for (const requestStr of requests) {
          if (!requestStr) continue;
          
          const request = JSON.parse(requestStr);
          
          // Simulate delay if configured
          if (this.delay > 0) {
            await new Promise(resolve => setTimeout(resolve, this.delay));
          }
          
          // Simulate crash if configured
          if (this.shouldCrash) {
            process.exit(1);
          }
          
          // Simulate timeout if configured (by not responding)
          if (this.shouldTimeout) {
            continue;
          }
          
          // Handle different methods
          let response;
          if (this.failRequests) {
            response = {
              jsonrpc: '2.0',
              id: request.id,
              error: {
                code: -32000,
                message: 'Mock server error'
              }
            };
          } else {
            switch (request.method) {
              case 'listTools':
                response = {
                  jsonrpc: '2.0',
                  id: request.id,
                  result: { tools: this.tools }
                };
                break;
                
              case 'listResources':
                response = {
                  jsonrpc: '2.0',
                  id: request.id,
                  result: { resources: this.resources }
                };
                break;
                
              case 'listResourceTemplates':
                response = {
                  jsonrpc: '2.0',
                  id: request.id,
                  result: { resourceTemplates: this.resourceTemplates }
                };
                break;
                
              case 'callTool':
                const { name, arguments: args } = request.params;
                
                // Mock different tool behaviors
                if (name === 'test_tool') {
                  response = {
                    jsonrpc: '2.0',
                    id: request.id,
                    result: {
                      content: [
                        {
                          type: 'text',
                          text: `Tool executed with args: ${JSON.stringify(args)}`
                        }
                      ]
                    }
                  };
                } else {
                  response = {
                    jsonrpc: '2.0',
                    id: request.id,
                    error: {
                      code: -32601,
                      message: `Tool ${name} not found`
                    }
                  };
                }
                break;
                
              case 'readResource':
                const { uri } = request.params;
                
                if (uri === 'test://resource1') {
                  response = {
                    jsonrpc: '2.0',
                    id: request.id,
                    result: {
                      contents: [
                        {
                          uri: 'test://resource1',
                          mimeType: 'application/json',
                          text: JSON.stringify({ data: 'test_data' })
                        }
                      ]
                    }
                  };
                } else if (uri.startsWith('test://')) {
                  // Handle template matching
                  const match = uri.match(/^test:\/\/([^\/]+)\/data$/);
                  if (match) {
                    response = {
                      jsonrpc: '2.0',
                      id: request.id,
                      result: {
                        contents: [
                          {
                            uri,
                            mimeType: 'application/json',
                            text: JSON.stringify({ param: match[1] })
                          }
                        ]
                      }
                    };
                  } else {
                    response = {
                      jsonrpc: '2.0',
                      id: request.id,
                      error: {
                        code: -32000,
                        message: 'Invalid resource URI'
                      }
                    };
                  }
                } else {
                  response = {
                    jsonrpc: '2.0',
                    id: request.id,
                    error: {
                      code: -32000,
                      message: `Resource ${uri} not found`
                    }
                  };
                }
                break;
                
              default:
                response = {
                  jsonrpc: '2.0',
                  id: request.id,
                  error: {
                    code: -32601,
                    message: `Method ${request.method} not found`
                  }
                };
            }
          }
          
          // Send response
          if (response) {
            process.stdout.write(JSON.stringify(response) + '\n');
          }
        }
      } catch (error) {
        console.error('Error processing request:', error);
      }
    });
  }
}

// If this file is run directly, start the mock server
if (require.main === module) {
  const server = new MockMcpServer();
  server.start();
}
