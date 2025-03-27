import { AgentService } from '../../services/agent';
import { MockMcpServer } from '../mocks/mock-mcp-server';
import { expect } from 'chai';
import sinon from 'sinon';
import path from 'path';
import fs from 'fs/promises';
import { ChildProcess } from 'child_process';

describe('AgentService MCP Integration', function() {
  // Set timeout for integration tests
  this.timeout(10000);
  
  let agent: AgentService;
  let mockServerProcess: ChildProcess;
  const tempDir = path.join(__dirname, '..', 'temp');
  const mcpConfigPath = path.join(tempDir, 'mcp-settings.json');
  
  before(async () => {
    // Create temp directory if it doesn't exist
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (error) {
      // Ignore if directory already exists
    }
    
    // Create MCP config with mock server
    const mcpConfig = {
      mcpServers: {
        testServer: {
          command: 'node',
          args: [path.join(__dirname, '..', 'mocks', 'mock-mcp-runner.js')],
          disabled: false
        }
      }
    };
    
    await fs.writeFile(mcpConfigPath, JSON.stringify(mcpConfig), 'utf8');
    
    // Create mock server runner script
    const mockRunnerPath = path.join(__dirname, '..', 'mocks', 'mock-mcp-runner.js');
    const mockRunnerContent = `
      const { MockMcpServer } = require('./mock-mcp-server');
      const server = new MockMcpServer();
      server.start();
    `;
    
    await fs.writeFile(mockRunnerPath, mockRunnerContent, 'utf8');
  });
  
  beforeEach(() => {
    // Stub the mcpConfigPath used in agent to point to our temp config
    sinon.stub(path, 'join')
      .withArgs(sinon.match.any, 'config', 'mcp-settings.json')
      .returns(mcpConfigPath)
      .callThrough();
    
    // Create agent instance
    agent = new AgentService(tempDir);
  });
  
  afterEach(async () => {
    // Clean up
    sinon.restore();
    
    // Wait for agent to properly clean up its resources
    await new Promise(resolve => setTimeout(resolve, 100));
  });
  
  after(async () => {
    // Clean up temp directory and files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Error cleaning up temp directory:', error);
    }
  });
  
  describe('MCP initialization', () => {
    it('should initialize MCP components', () => {
      // Verify MCP components are initialized
      expect(agent['mcpHub']).to.exist;
      expect(agent['mcpConfigManager']).to.exist;
    });
  });
  
  describe('MCP tools in system prompt', () => {
    it('should include MCP tools in system prompt', async () => {
      // Get system prompt
      const systemPrompt = agent['generateSystemPrompt']();
      
      // Verify system prompt includes MCP sections
      expect(systemPrompt).to.include('## use_mcp_tool');
      expect(systemPrompt).to.include('## access_mcp_resource');
    });
  });
  
  describe('Tool execution', () => {
    it('should execute use_mcp_tool successfully', async () => {
      // Mock tool execution
      const toolUse = {
        id: '123',
        name: 'use_mcp_tool',
        params: {
          server_name: 'testServer',
          tool_name: 'test_tool',
          arguments: JSON.stringify({ param1: 'test' })
        }
      };
      
      // Set up listeners to capture results
      let toolResult: string | undefined;
      agent.setCallbacks({
        onToolResult: (result) => {
          toolResult = result;
        }
      });
      
      // Execute tool
      await agent['executeTool'](toolUse);
      
      // Verify result
      expect(toolResult).to.exist;
      expect(toolResult).to.include('Tool execution result');
    });
    
    it('should execute access_mcp_resource successfully', async () => {
      // Mock resource access
      const toolUse = {
        id: '123',
        name: 'access_mcp_resource',
        params: {
          server_name: 'testServer',
          uri: 'test://resource1'
        }
      };
      
      // Set up listeners to capture results
      let toolResult: string | undefined;
      agent.setCallbacks({
        onToolResult: (result) => {
          toolResult = result;
        }
      });
      
      // Execute tool
      await agent['executeTool'](toolUse);
      
      // Verify result
      expect(toolResult).to.exist;
      expect(toolResult).to.include('Resource content');
    });
  });
  
  describe('Error handling', () => {
    it('should handle MCP server not found', async () => {
      // Mock invalid server
      const toolUse = {
        id: '123',
        name: 'use_mcp_tool',
        params: {
          server_name: 'nonexistentServer',
          tool_name: 'test_tool',
          arguments: JSON.stringify({ param1: 'test' })
        }
      };
      
      // Set up listeners to capture results
      let toolResult: string | undefined;
      agent.setCallbacks({
        onToolResult: (result) => {
          toolResult = result;
        }
      });
      
      // Execute tool
      await agent['executeTool'](toolUse);
      
      // Verify error is returned
      expect(toolResult).to.exist;
      expect(toolResult).to.include('Error executing MCP tool');
      expect(toolResult).to.include('not found');
    });
    
    it('should handle invalid tool name', async () => {
      // Mock invalid tool
      const toolUse = {
        id: '123',
        name: 'use_mcp_tool',
        params: {
          server_name: 'testServer',
          tool_name: 'nonexistentTool',
          arguments: JSON.stringify({ param1: 'test' })
        }
      };
      
      // Set up listeners to capture results
      let toolResult: string | undefined;
      agent.setCallbacks({
        onToolResult: (result) => {
          toolResult = result;
        }
      });
      
      // Execute tool
      await agent['executeTool'](toolUse);
      
      // Verify error is returned
      expect(toolResult).to.exist;
      expect(toolResult).to.include('Error executing MCP tool');
      expect(toolResult).to.include('not found');
    });
    
    it('should handle invalid resource URI', async () => {
      // Mock invalid resource
      const toolUse = {
        id: '123',
        name: 'access_mcp_resource',
        params: {
          server_name: 'testServer',
          uri: 'test://nonexistentResource'
        }
      };
      
      // Set up listeners to capture results
      let toolResult: string | undefined;
      agent.setCallbacks({
        onToolResult: (result) => {
          toolResult = result;
        }
      });
      
      // Execute tool
      await agent['executeTool'](toolUse);
      
      // Verify error is returned
      expect(toolResult).to.exist;
      expect(toolResult).to.include('Error accessing MCP resource');
      expect(toolResult).to.include('not found');
    });
  });
});
