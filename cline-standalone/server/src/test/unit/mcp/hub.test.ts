import { McpHub } from '../../../services/mcp/hub';
import { McpProtocol } from '../../../services/mcp/protocol';
import { expect } from 'chai';
import sinon from 'sinon';
import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { MockMcpServer } from '../../mocks/mock-mcp-server';

describe('McpHub', () => {
  let hub: McpHub;
  let spawnStub: sinon.SinonStub;
  let mockProcess: any;
  let mockProtocol: Partial<McpProtocol>;
  
  beforeEach(() => {
    // Create McpHub instance
    hub = new McpHub();
    
    // Create mock child process
    mockProcess = new EventEmitter() as unknown as ChildProcess;
    mockProcess.stdin = new EventEmitter() as any;
    mockProcess.stdin.end = sinon.stub();
    mockProcess.killed = false;
    mockProcess.kill = sinon.stub();
    
    // Create stub for spawn
    spawnStub = sinon.stub().returns(mockProcess);
    sinon.stub(require('child_process'), 'spawn').callsFake(spawnStub);
    
    // Create mock protocol
    mockProtocol = {
      listTools: sinon.stub().resolves({ tools: [] }),
      listResources: sinon.stub().resolves({ resources: [] }),
      listResourceTemplates: sinon.stub().resolves({ resourceTemplates: [] }),
      callTool: sinon.stub().resolves({}),
      readResource: sinon.stub().resolves({}),
      on: sinon.stub()
    };
    
    // Create a class replacement instead of stubbing the constructor
    class MockMcpProtocol extends EventEmitter {
      constructor() {
        super();
        Object.assign(this, mockProtocol);
      }
    }
    
    // Replace the McpProtocol class
    sinon.replace(require('../../../services/mcp/protocol'), 'McpProtocol', MockMcpProtocol);
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('startServers', () => {
    it('should start configured servers', async () => {
      // Setup mock config
      const configs = {
        server1: { command: 'cmd1', args: [] },
        server2: { command: 'cmd2', args: ['-v'], disabled: true },
        server3: { command: 'cmd3', args: [], env: { VAR: 'value' } }
      };
      
      // Stub startServer
      const startServerStub = sinon.stub(hub, 'startServer').resolves();
      
      // Test startServers
      await hub.startServers(configs);
      
      // Verify startServer called for enabled servers
      expect(startServerStub.calledWith('server1', configs.server1)).to.be.true;
      expect(startServerStub.calledWith('server2', configs.server2)).to.be.false;
      expect(startServerStub.calledWith('server3', configs.server3)).to.be.true;
    });
    
    it('should stop running servers before starting new ones', async () => {
      // Setup running server
      const configs = {
        server1: { command: 'cmd1', args: [] }
      };
      
      // Manually set a running server
      (hub as any).servers.set('existing', {
        process: mockProcess,
        status: 'connected'
      });
      
      // Stub methods
      const stopServerStub = sinon.stub(hub, 'stopServer').resolves();
      const startServerStub = sinon.stub(hub, 'startServer').resolves();
      
      // Test startServers
      await hub.startServers(configs);
      
      // Verify stopServer called for existing server
      expect(stopServerStub.calledWith('existing')).to.be.true;
      
      // Verify startServer called for new config
      expect(startServerStub.calledWith('server1', configs.server1)).to.be.true;
    });
    
    it('should handle errors in starting individual servers', async () => {
      // Setup mock config
      const configs = {
        server1: { command: 'cmd1', args: [] },
        server2: { command: 'cmd2', args: [] }
      };
      
      // Stub startServer to succeed for server1 and fail for server2
      const startServerStub = sinon.stub(hub, 'startServer');
      startServerStub.withArgs('server1', configs.server1).resolves();
      startServerStub.withArgs('server2', configs.server2).rejects(new Error('Failed to start'));
      
      // Listen for error events
      const errorSpy = sinon.spy();
      hub.on('server-error', errorSpy);
      
      // Test startServers
      await hub.startServers(configs);
      
      // Verify startServer called for both servers
      expect(startServerStub.calledWith('server1', configs.server1)).to.be.true;
      expect(startServerStub.calledWith('server2', configs.server2)).to.be.true;
      
      // Verify error event emitted for server2
      expect(errorSpy.calledWith('server2', 'Failed to start')).to.be.true;
    });
  });
  
  describe('startServer', () => {
    it('should properly start a server process', async () => {
      // Setup mock config
      const config = {
        command: 'node',
        args: ['server.js'],
        env: { TEST_VAR: 'value' }
      };
      
      // Mock protocol responses
      (mockProtocol.listTools as sinon.SinonStub).resolves({
        tools: [{ name: 'test_tool' }]
      });
      (mockProtocol.listResources as sinon.SinonStub).resolves({
        resources: [{ uri: 'test://resource' }]
      });
      (mockProtocol.listResourceTemplates as sinon.SinonStub).resolves({
        resourceTemplates: [{ uriTemplate: 'test://{param}' }]
      });
      
      // Listen for events
      const connectingSpy = sinon.spy();
      const connectedSpy = sinon.spy();
      hub.on('server-connecting', connectingSpy);
      hub.on('server-connected', connectedSpy);
      
      // Test startServer
      await hub.startServer('test', config);
      
      // Verify spawn called correctly
      expect(spawnStub.calledWith(config.command, config.args, {
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe']
      })).to.be.true;
      
      // Verify events emitted
      expect(connectingSpy.calledWith('test')).to.be.true;
      expect(connectedSpy.calledWith('test')).to.be.true;
      
      // Verify server state
      const serverStatus = hub.getServerStatus('test');
      expect(serverStatus).to.equal('connected');
      
      // Verify tools and resources fetched
      const allToolsAndResources = hub.getAllToolsAndResources();
      expect(allToolsAndResources.tools).to.have.lengthOf(1);
      expect(allToolsAndResources.resources).to.have.lengthOf(1);
      expect(allToolsAndResources.resourceTemplates).to.have.lengthOf(1);
    });
    
    it('should handle server startup errors', async () => {
      // Setup to fail
      spawnStub.throws(new Error('Failed to spawn process'));
      
      // Listen for error events
      const errorSpy = sinon.spy();
      hub.on('server-error', errorSpy);
      
      // Test startServer
      await hub.startServer('test', { command: 'node', args: [] });
      
      // Verify error event
      expect(errorSpy.calledWith('test')).to.be.true;
      
      // Verify server status
      const serverStatus = hub.getServerStatus('test');
      expect(serverStatus).to.equal('disconnected');
    });
    
    it('should handle errors during capability fetching', async () => {
      // Mock protocol failures
      (mockProtocol.listTools as sinon.SinonStub).rejects(new Error('Failed to list tools'));
      
      // Listen for error events
      const errorSpy = sinon.spy();
      hub.on('server-error', errorSpy);
      
      // Test startServer
      await hub.startServer('test', { command: 'node', args: [] });
      
      // Verify error event
      expect(errorSpy.calledWith('test')).to.be.true;
      
      // Verify server status
      const serverStatus = hub.getServerStatus('test');
      expect(serverStatus).to.equal('disconnected');
    });
    
    it('should handle server exit', async () => {
      // Setup mock config
      const config = { command: 'node', args: [] };
      
      // Test startServer (all protocol calls succeed)
      await hub.startServer('test', config);
      
      // Verify server is connected
      expect(hub.getServerStatus('test')).to.equal('connected');
      
      // Simulate server exit
      mockProcess.emit('exit', 1);
      
      // Verify server is disconnected
      expect(hub.getServerStatus('test')).to.equal('disconnected');
    });
  });
  
  describe('stopServer', () => {
    it('should properly stop a running server', async () => {
      // Setup a running server
      (hub as any).servers.set('test', {
        process: mockProcess,
        protocol: mockProtocol,
        status: 'connected',
        config: { command: 'test' },
        tools: [],
        resources: [],
        resourceTemplates: []
      });
      
      // Listen for events
      const disconnectedSpy = sinon.spy();
      hub.on('server-disconnected', disconnectedSpy);
      
      // Test stopServer
      await hub.stopServer('test');
      
      // Verify stdin.end called
      expect(mockProcess.stdin.end.called).to.be.true;
      
      // Verify event emitted
      expect(disconnectedSpy.calledWith('test')).to.be.true;
      
      // Verify server state
      const serverStatus = hub.getServerStatus('test');
      expect(serverStatus).to.equal('disconnected');
      
      // Verify process fields cleared
      const server = (hub as any).servers.get('test');
      expect(server.process).to.be.null;
      expect(server.protocol).to.be.null;
    });
    
    it('should do nothing if server does not exist', async () => {
      // Test stopServer
      await hub.stopServer('nonexistent');
      
      // Verify server status
      const serverStatus = hub.getServerStatus('nonexistent');
      expect(serverStatus).to.equal('not-found');
    });
  });
  
  describe('executeTool', () => {
    beforeEach(() => {
      // Setup a connected server
      (hub as any).servers.set('test', {
        process: mockProcess,
        protocol: mockProtocol,
        status: 'connected',
        config: { command: 'test' },
        tools: [{ name: 'test_tool' }],
        resources: [],
        resourceTemplates: []
      });
    });
    
    it('should execute a tool successfully', async () => {
      // Setup expected result
      const expectedResult = { result: 'success' };
      (mockProtocol.callTool as sinon.SinonStub).resolves(expectedResult);
      
      // Test executeTool
      const result = await hub.executeTool('test', 'test_tool', { param: 'value' });
      
      // Verify protocol.callTool called correctly
      expect((mockProtocol.callTool as sinon.SinonStub).calledWith('test_tool', { param: 'value' })).to.be.true;
      
      // Verify result
      expect(result).to.deep.equal(expectedResult);
    });
    
    it('should throw if server not found', async () => {
      try {
        await hub.executeTool('nonexistent', 'test_tool', {});
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).to.include('not found');
      }
    });
    
    it('should throw if server not connected', async () => {
      // Setup a disconnected server
      (hub as any).servers.set('disconnected', {
        status: 'disconnected',
        config: { command: 'test' },
        tools: [{ name: 'test_tool' }],
        resources: [],
        resourceTemplates: []
      });
      
      try {
        await hub.executeTool('disconnected', 'test_tool', {});
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).to.include('not connected');
      }
    });
    
    it('should throw if tool not found', async () => {
      try {
        await hub.executeTool('test', 'nonexistent_tool', {});
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).to.include('not found');
      }
    });
  });
  
  describe('accessResource', () => {
    beforeEach(() => {
      // Setup a connected server
      (hub as any).servers.set('test', {
        process: mockProcess,
        protocol: mockProtocol,
        status: 'connected',
        config: { command: 'test' },
        tools: [],
        resources: [{ uri: 'test://resource' }],
        resourceTemplates: []
      });
    });
    
    it('should access a resource successfully', async () => {
      // Setup expected result
      const expectedResult = { content: 'data' };
      (mockProtocol.readResource as sinon.SinonStub).resolves(expectedResult);
      
      // Test accessResource
      const result = await hub.accessResource('test', 'test://resource');
      
      // Verify protocol.readResource called correctly
      expect((mockProtocol.readResource as sinon.SinonStub).calledWith('test://resource')).to.be.true;
      
      // Verify result
      expect(result).to.deep.equal(expectedResult);
    });
    
    it('should throw if server not found', async () => {
      try {
        await hub.accessResource('nonexistent', 'test://resource');
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).to.include('not found');
      }
    });
    
    it('should throw if server not connected', async () => {
      // Setup a disconnected server
      (hub as any).servers.set('disconnected', {
        status: 'disconnected',
        config: { command: 'test' },
        tools: [],
        resources: [{ uri: 'test://resource' }],
        resourceTemplates: []
      });
      
      try {
        await hub.accessResource('disconnected', 'test://resource');
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).to.include('not connected');
      }
    });
  });
  
  describe('getServerStatus', () => {
    it('should return correct status for existing servers', () => {
      // Setup servers with different statuses
      (hub as any).servers.set('connected', { status: 'connected' });
      (hub as any).servers.set('connecting', { status: 'connecting' });
      (hub as any).servers.set('disconnected', { status: 'disconnected' });
      
      // Verify status
      expect(hub.getServerStatus('connected')).to.equal('connected');
      expect(hub.getServerStatus('connecting')).to.equal('connecting');
      expect(hub.getServerStatus('disconnected')).to.equal('disconnected');
    });
    
    it('should return not-found for non-existent servers', () => {
      expect(hub.getServerStatus('nonexistent')).to.equal('not-found');
    });
  });
  
  describe('getAllServers', () => {
    it('should return information about all servers', () => {
      // Setup servers
      (hub as any).servers.set('server1', {
        status: 'connected',
        tools: [{ name: 'tool1' }],
        resources: [{ uri: 'test://resource1' }],
        resourceTemplates: []
      });
      
      (hub as any).servers.set('server2', {
        status: 'disconnected',
        error: 'Failed to connect',
        tools: [],
        resources: [],
        resourceTemplates: []
      });
      
      // Test getAllServers
      const servers = hub.getAllServers();
      
      // Verify result
      expect(servers).to.have.keys('server1', 'server2');
      expect(servers.server1.status).to.equal('connected');
      expect(servers.server1.tools).to.have.lengthOf(1);
      expect(servers.server2.status).to.equal('disconnected');
      expect(servers.server2.error).to.equal('Failed to connect');
    });
  });
  
  describe('getAllToolsAndResources', () => {
    it('should return all tools and resources from connected servers', () => {
      // Setup connected server
      (hub as any).servers.set('connected', {
        status: 'connected',
        tools: [{ name: 'tool1' }, { name: 'tool2' }],
        resources: [{ uri: 'test://resource1' }],
        resourceTemplates: [{ uriTemplate: 'test://{param}' }]
      });
      
      // Setup disconnected server (should be ignored)
      (hub as any).servers.set('disconnected', {
        status: 'disconnected',
        tools: [{ name: 'ignoredTool' }],
        resources: [{ uri: 'test://ignoredResource' }],
        resourceTemplates: []
      });
      
      // Test getAllToolsAndResources
      const result = hub.getAllToolsAndResources();
      
      // Verify result
      expect(result.tools).to.have.lengthOf(2);
      expect(result.resources).to.have.lengthOf(1);
      expect(result.resourceTemplates).to.have.lengthOf(1);
      
      // Verify serverName is included
      expect(result.tools[0].serverName).to.equal('connected');
      expect(result.resources[0].serverName).to.equal('connected');
      expect(result.resourceTemplates[0].serverName).to.equal('connected');
    });
  });
});
