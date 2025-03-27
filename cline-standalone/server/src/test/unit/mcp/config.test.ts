import { McpConfigManager } from '../../../services/mcp/config';
import fs from 'fs/promises';
import path from 'path';
import { expect } from 'chai';
import sinon from 'sinon';

describe('McpConfigManager', () => {
  const testConfigPath = path.join(__dirname, 'test-mcp-config.json');
  let configManager: McpConfigManager;
  let fsStub: sinon.SinonStub;
  
  beforeEach(() => {
    // Create config manager with test path
    configManager = new McpConfigManager(testConfigPath);
    
    // Stub filesystem to avoid actual file operations
    fsStub = sinon.stub(fs, 'readFile');
    sinon.stub(fs, 'writeFile').resolves();
    sinon.stub(fs, 'mkdir').resolves();
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('loadConfig', () => {
    it('should load configuration from file', async () => {
      // Setup mock config file
      const mockConfig = {
        mcpServers: {
          test1: { command: 'test', args: [] },
          test2: { command: 'test2', args: ['-v'] }
        }
      };
      
      fsStub.resolves(JSON.stringify(mockConfig));
      
      // Test loading
      const config = await configManager.loadConfig();
      
      expect(config).to.deep.equal(mockConfig.mcpServers);
      expect(fsStub.calledWith(testConfigPath, 'utf8')).to.be.true;
    });
    
    it('should return empty object if file does not exist', async () => {
      // Setup file not found error
      const error: NodeJS.ErrnoException = new Error('File not found');
      error.code = 'ENOENT';
      fsStub.rejects(error);
      
      // Test loading
      const config = await configManager.loadConfig();
      
      expect(config).to.deep.equal({});
    });
    
    it('should propagate other errors', async () => {
      // Setup other error
      fsStub.rejects(new Error('Permission denied'));
      
      // Test loading
      try {
        await configManager.loadConfig();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Permission denied');
      }
    });
  });
  
  describe('saveConfig', () => {
    it('should save configuration to file', async () => {
      const writeFileStub = fs.writeFile as sinon.SinonStub;
      const mkdirStub = fs.mkdir as sinon.SinonStub;
      
      const mockConfig = {
        test1: { command: 'test', args: [] }
      };
      
      // Test saving
      await configManager.saveConfig(mockConfig);
      
      // Verify directory creation
      expect(mkdirStub.calledWith(path.dirname(testConfigPath), { recursive: true })).to.be.true;
      
      // Verify file write
      expect(writeFileStub.calledWith(
        testConfigPath, 
        JSON.stringify({ mcpServers: mockConfig }, null, 2), 
        'utf8'
      )).to.be.true;
    });
  });
  
  describe('addServer', () => {
    it('should add a new server to configuration', async () => {
      // Setup existing config
      const existingConfig = {
        existing: { command: 'existing', args: [] }
      };
      
      fsStub.resolves(JSON.stringify({ mcpServers: existingConfig }));
      
      const writeFileStub = fs.writeFile as sinon.SinonStub;
      
      // Test adding server
      const newServer = { command: 'new', args: ['-t'] };
      await configManager.addServer('new', newServer);
      
      // Verify write with combined config
      const expectedConfig = {
        existing: existingConfig.existing,
        new: newServer
      };
      
      expect(writeFileStub.calledWith(
        testConfigPath,
        JSON.stringify({ mcpServers: expectedConfig }, null, 2),
        'utf8'
      )).to.be.true;
    });
  });
  
  describe('removeServer', () => {
    it('should remove a server from configuration', async () => {
      // Setup existing config
      const existingConfig = {
        server1: { command: 'cmd1', args: [] },
        server2: { command: 'cmd2', args: [] }
      };
      
      fsStub.resolves(JSON.stringify({ mcpServers: existingConfig }));
      
      const writeFileStub = fs.writeFile as sinon.SinonStub;
      
      // Test removing server
      await configManager.removeServer('server1');
      
      // Verify write with server removed
      const expectedConfig = {
        server2: existingConfig.server2
      };
      
      expect(writeFileStub.calledWith(
        testConfigPath,
        JSON.stringify({ mcpServers: expectedConfig }, null, 2),
        'utf8'
      )).to.be.true;
    });
    
    it('should do nothing if server does not exist', async () => {
      // Setup existing config
      const existingConfig = {
        server1: { command: 'cmd1', args: [] }
      };
      
      fsStub.resolves(JSON.stringify({ mcpServers: existingConfig }));
      
      const writeFileStub = fs.writeFile as sinon.SinonStub;
      
      // Test removing non-existent server
      await configManager.removeServer('nonexistent');
      
      // Verify write with unchanged config
      expect(writeFileStub.calledWith(
        testConfigPath,
        JSON.stringify({ mcpServers: existingConfig }, null, 2),
        'utf8'
      )).to.be.true;
    });
  });
  
  describe('updateServer', () => {
    it('should update an existing server', async () => {
      // Setup existing config
      const existingConfig = {
        server1: { command: 'cmd1', args: [], env: { VAR: 'value' } }
      };
      
      fsStub.resolves(JSON.stringify({ mcpServers: existingConfig }));
      
      const writeFileStub = fs.writeFile as sinon.SinonStub;
      
      // Test updating server
      await configManager.updateServer('server1', { args: ['-v'], disabled: true });
      
      // Verify write with updated config
      const expectedConfig = {
        server1: { 
          command: 'cmd1', 
          args: ['-v'], 
          env: { VAR: 'value' },
          disabled: true
        }
      };
      
      expect(writeFileStub.calledWith(
        testConfigPath,
        JSON.stringify({ mcpServers: expectedConfig }, null, 2),
        'utf8'
      )).to.be.true;
    });
    
    it('should throw error when updating non-existent server', async () => {
      // Setup existing config
      const existingConfig = { server1: { command: 'cmd1', args: [] } };
      
      fsStub.resolves(JSON.stringify({ mcpServers: existingConfig }));
      
      // Test updating non-existent server
      try {
        await configManager.updateServer('nonexistent', { args: ['-v'] });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('MCP server nonexistent not found in configuration');
      }
    });
  });
});
