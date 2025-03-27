import { McpProtocol } from '../../../services/mcp/protocol';
import { expect } from 'chai';
import sinon from 'sinon';
import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';

describe('McpProtocol', () => {
  let protocol: McpProtocol;
  let mockProcess: any;
  let stdin: Writable;
  let stdout: Readable;
  let stderr: Readable;
  
  beforeEach(() => {
    // Create mock process with streams
    stdin = new Writable({
      write(chunk, encoding, callback) {
        callback();
        return true;
      }
    });
    
    stdout = new Readable({
      read() {}
    });
    
    stderr = new Readable({
      read() {}
    });
    
    mockProcess = new EventEmitter();
    mockProcess.stdin = stdin;
    mockProcess.stdout = stdout;
    mockProcess.stderr = stderr;
    
    // Spy on stdin.write
    sinon.spy(stdin, 'write');
    
    // Create protocol instance
    protocol = new McpProtocol(mockProcess as any);
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('sendRequest', () => {
    it('should send properly formatted JSON-RPC request', async () => {
      // Setup response
      const responsePromise = protocol.sendRequest('testMethod', { param: 'value' });
      
      // Extract the request from stdin write
      const writeCall = (stdin.write as sinon.SinonSpy).getCall(0);
      const request = JSON.parse(writeCall.args[0]);
      
      // Verify request format
      expect(request.jsonrpc).to.equal('2.0');
      expect(request.method).to.equal('testMethod');
      expect(request.params).to.deep.equal({ param: 'value' });
      expect(request.id).to.be.a('string');
      
      // Send response
      stdout.push(JSON.stringify({
        jsonrpc: '2.0',
        id: request.id,
        result: { success: true }
      }) + '\n');
      
      // Verify response handling
      const response = await responsePromise;
      expect(response).to.deep.equal({ success: true });
    });
    
    it('should handle error responses', async () => {
      // Setup request
      const requestPromise = protocol.sendRequest('failingMethod', {});
      
      // Extract the request from stdin write
      const writeCall = (stdin.write as sinon.SinonSpy).getCall(0);
      const request = JSON.parse(writeCall.args[0]);
      
      // Send error response
      stdout.push(JSON.stringify({
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32000,
          message: 'Test error'
        }
      }) + '\n');
      
      // Verify error handling
      try {
        await requestPromise;
        expect.fail('Should have rejected with error');
      } catch (error: any) {
        expect(error.message).to.equal('Test error');
      }
    });
    
    it('should handle timeouts', async () => {
      // Use a short timeout
      const clock = sinon.useFakeTimers();
      
      // Setup request with short timeout
      const requestPromise = protocol.sendRequest('timeoutMethod', {}, 500);
      
      // Advance time past timeout
      clock.tick(600);
      
      // Verify timeout handling
      try {
        await requestPromise;
        expect.fail('Should have rejected with timeout');
      } catch (error: any) {
        expect(error.message).to.include('timed out after 500ms');
      } finally {
        clock.restore();
      }
    });
    
    it('should handle process exit during request', async () => {
      // Setup request
      const requestPromise = protocol.sendRequest('exitMethod', {});
      
      // Simulate process exit
      mockProcess.emit('exit', 1);
      
      // Verify exit handling
      try {
        await requestPromise;
        expect.fail('Should have rejected with exit error');
      } catch (error: any) {
        expect(error.message).to.include('process exited with code 1');
      }
    });
  });
  
  describe('MCP operation methods', () => {
    let sendRequestStub: sinon.SinonStub;
    
    beforeEach(() => {
      // Stub the sendRequest method
      sendRequestStub = sinon.stub(protocol, 'sendRequest');
    });
    
    it('should correctly call listTools', async () => {
      sendRequestStub.resolves({ tools: [] });
      
      await protocol.listTools();
      
      expect(sendRequestStub.calledWith('listTools', {})).to.be.true;
    });
    
    it('should correctly call callTool', async () => {
      sendRequestStub.resolves({ result: 'success' });
      
      await protocol.callTool('testTool', { param: 'value' });
      
      expect(sendRequestStub.calledWith('callTool', {
        name: 'testTool',
        arguments: { param: 'value' }
      })).to.be.true;
    });
    
    it('should correctly call listResources', async () => {
      sendRequestStub.resolves({ resources: [] });
      
      await protocol.listResources();
      
      expect(sendRequestStub.calledWith('listResources', {})).to.be.true;
    });
    
    it('should correctly call listResourceTemplates', async () => {
      sendRequestStub.resolves({ resourceTemplates: [] });
      
      await protocol.listResourceTemplates();
      
      expect(sendRequestStub.calledWith('listResourceTemplates', {})).to.be.true;
    });
    
    it('should correctly call readResource', async () => {
      sendRequestStub.resolves({ content: 'data' });
      
      await protocol.readResource('test://uri');
      
      expect(sendRequestStub.calledWith('readResource', { uri: 'test://uri' })).to.be.true;
    });
  });
  
  describe('event handling', () => {
    it('should emit message events for non-response messages', (done) => {
      // Setup event listener
      protocol.on('message', (message) => {
        expect(message).to.deep.equal({ type: 'notification', data: 'test' });
        done();
      });
      
      // Push non-request message
      stdout.push(JSON.stringify({ type: 'notification', data: 'test' }) + '\n');
    });
    
    it('should handle multiple messages in a single chunk', async () => {
      // Setup requests
      const request1Promise = protocol.sendRequest('method1', {});
      const request2Promise = protocol.sendRequest('method2', {});
      
      // Extract request IDs
      const writeCall1 = (stdin.write as sinon.SinonSpy).getCall(0);
      const writeCall2 = (stdin.write as sinon.SinonSpy).getCall(1);
      const request1 = JSON.parse(writeCall1.args[0]);
      const request2 = JSON.parse(writeCall2.args[0]);
      
      // Push multiple responses in one chunk
      stdout.push(
        JSON.stringify({
          jsonrpc: '2.0',
          id: request1.id,
          result: { method: 'method1' }
        }) + '\n' +
        JSON.stringify({
          jsonrpc: '2.0',
          id: request2.id,
          result: { method: 'method2' }
        }) + '\n'
      );
      
      // Verify both responses are handled
      const [response1, response2] = await Promise.all([request1Promise, request2Promise]);
      
      expect(response1).to.deep.equal({ method: 'method1' });
      expect(response2).to.deep.equal({ method: 'method2' });
    });
    
    it('should handle stderr output', (done) => {
      // Push error message
      stderr.push('Error in server');
      
      // Let event loop complete
      setTimeout(done, 10);
    });
  });
});
