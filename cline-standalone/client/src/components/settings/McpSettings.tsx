import React, { useState, useEffect } from 'react';
import { socket } from '../../socket';
import './McpSettings.css';

interface McpServer {
  command: string;
  args: string[];
  env?: Record<string, any>;
  disabled?: boolean;
  timeout?: number;
  autoApprove?: string[];
}

interface ServerStatus {
  status: 'connected' | 'connecting' | 'disconnected';
  error?: string;
  tools: any[];
  resources: any[];
  resourceTemplates: any[];
}

const McpSettings: React.FC = () => {
  const [mcpServers, setMcpServers] = useState<Record<string, McpServer>>({});
  const [serverStatus, setServerStatus] = useState<Record<string, ServerStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editServer, setEditServer] = useState<{name: string, config: McpServer} | null>(null);
  const [newServerName, setNewServerName] = useState('');
  const [newServerCommand, setNewServerCommand] = useState('');
  const [newServerArgs, setNewServerArgs] = useState('');
  const [newServerEnv, setNewServerEnv] = useState('');

  useEffect(() => {
    loadConfig();
    loadStatus();
    
    // Set up periodic status updates
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadConfig = () => {
    setIsLoading(true);
    socket.emit('get_mcp_config', (response: any) => {
      setIsLoading(false);
      if (response.success) {
        setMcpServers(response.config || {});
      } else {
        setErrorMessage(`Failed to load MCP configuration: ${response.error}`);
      }
    });
  };

  const loadStatus = () => {
    socket.emit('get_mcp_status', (response: any) => {
      if (response.success) {
        setServerStatus(response.servers || {});
      }
    });
  };

  const saveConfig = () => {
    setIsLoading(true);
    socket.emit('save_mcp_config', { mcpServers }, (response: any) => {
      setIsLoading(false);
      if (response.success) {
        setErrorMessage('Configuration saved successfully!');
        setTimeout(() => setErrorMessage(null), 3000);
      } else {
        setErrorMessage(`Failed to save MCP configuration: ${response.error}`);
      }
    });
  };

  const toggleServer = (name: string, isDisabled: boolean) => {
    const updatedServers = { ...mcpServers };
    updatedServers[name] = {
      ...updatedServers[name],
      disabled: isDisabled
    };
    setMcpServers(updatedServers);
  };

  const startServer = (name: string) => {
    socket.emit('start_mcp_server', { name }, (response: any) => {
      if (!response.success) {
        setErrorMessage(`Failed to start server ${name}: ${response.error}`);
      } else {
        loadStatus();
      }
    });
  };

  const stopServer = (name: string) => {
    socket.emit('stop_mcp_server', { name }, (response: any) => {
      if (!response.success) {
        setErrorMessage(`Failed to stop server ${name}: ${response.error}`);
      } else {
        loadStatus();
      }
    });
  };

  const handleAddServer = () => {
    // Validate inputs
    if (!newServerName || !newServerCommand) {
      setErrorMessage('Server name and command are required');
      return;
    }

    // Parse args and env
    const args = newServerArgs.split(' ').filter(arg => arg.trim() !== '');
    let env: Record<string, string> = {};
    
    try {
      if (newServerEnv.trim()) {
        env = JSON.parse(newServerEnv);
      }
    } catch (error) {
      setErrorMessage('Invalid JSON format for environment variables');
      return;
    }

    // Create new server config
    const newServer: McpServer = {
      command: newServerCommand,
      args,
      env,
      disabled: false
    };

    // Add to server list
    const updatedServers = { ...mcpServers, [newServerName]: newServer };
    setMcpServers(updatedServers);

    // Clear form
    setNewServerName('');
    setNewServerCommand('');
    setNewServerArgs('');
    setNewServerEnv('');

    // Auto-save config
    socket.emit('save_mcp_config', { mcpServers: updatedServers }, (response: any) => {
      if (!response.success) {
        setErrorMessage(`Failed to save MCP configuration: ${response.error}`);
      } else {
        setErrorMessage('Server added successfully!');
        setTimeout(() => setErrorMessage(null), 3000);
        loadStatus();
      }
    });
  };

  const handleRemoveServer = (name: string) => {
    const updatedServers = { ...mcpServers };
    delete updatedServers[name];
    setMcpServers(updatedServers);

    // Auto-save config
    socket.emit('save_mcp_config', { mcpServers: updatedServers }, (response: any) => {
      if (!response.success) {
        setErrorMessage(`Failed to save MCP configuration: ${response.error}`);
      } else {
        setErrorMessage('Server removed successfully!');
        setTimeout(() => setErrorMessage(null), 3000);
      }
    });
  };

  return (
    <div className="mcp-settings">
      <h1>MCP Server Settings</h1>
      
      {errorMessage && (
        <div className="mcp-error-message">
          <p>{errorMessage}</p>
          <button onClick={() => setErrorMessage(null)}>Dismiss</button>
        </div>
      )}
      
      {isLoading ? (
        <div className="mcp-loading">Loading...</div>
      ) : (
        <>
          <div className="mcp-server-list">
            <h2>Configured Servers</h2>
            {Object.entries(mcpServers).length === 0 ? (
              <p>No MCP servers configured yet. Add a server below.</p>
            ) : (
              Object.entries(mcpServers).map(([name, config]) => {
                const status = serverStatus[name] || { status: 'unknown' };
                return (
                  <div key={name} className={`mcp-server-item ${status.status}`}>
                    <div className="mcp-server-header">
                      <h3>{name}</h3>
                      <span className={`mcp-status-badge ${status.status}`}>
                        {status.status}
                      </span>
                    </div>
                    
                    <div className="mcp-server-details">
                      <p><strong>Command:</strong> {config.command} {config.args?.join(' ')}</p>
                      {status.error && <p className="mcp-error"><strong>Error:</strong> {status.error}</p>}
                      
                      {status.tools && status.tools.length > 0 && (
                        <div className="mcp-server-tools">
                          <h4>Available Tools ({status.tools.length})</h4>
                          <ul>
                            {status.tools.map((tool: any, index) => (
                              <li key={index}>
                                <strong>{tool.name}</strong>
                                {tool.description && <p>{tool.description}</p>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    
                    <div className="mcp-server-actions">
                      <label>
                        <input
                          type="checkbox"
                          checked={!config.disabled}
                          onChange={() => toggleServer(name, !config.disabled)}
                        />
                        Enabled
                      </label>
                      
                      <button
                        onClick={() => status.status === 'connected' ? stopServer(name) : startServer(name)}
                        disabled={status.status === 'connecting'}
                        className={status.status === 'connected' ? 'stop-button' : 'start-button'}
                      >
                        {status.status === 'connected' ? 'Stop Server' : 'Start Server'}
                      </button>
                      
                      <button 
                        onClick={() => handleRemoveServer(name)}
                        className="remove-button"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          <div className="mcp-add-server">
            <h2>Add New MCP Server</h2>
            <div className="mcp-form-group">
              <label htmlFor="serverName">Server Name:</label>
              <input
                id="serverName"
                type="text"
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
                placeholder="e.g., weather-server"
              />
            </div>
            
            <div className="mcp-form-group">
              <label htmlFor="serverCommand">Command:</label>
              <input
                id="serverCommand"
                type="text"
                value={newServerCommand}
                onChange={(e) => setNewServerCommand(e.target.value)}
                placeholder="e.g., node or python3"
              />
            </div>
            
            <div className="mcp-form-group">
              <label htmlFor="serverArgs">Arguments (space separated):</label>
              <input
                id="serverArgs"
                type="text"
                value={newServerArgs}
                onChange={(e) => setNewServerArgs(e.target.value)}
                placeholder="e.g., -m mcp_server.main"
              />
            </div>
            
            <div className="mcp-form-group">
              <label htmlFor="serverEnv">Environment Variables (JSON):</label>
              <textarea
                id="serverEnv"
                value={newServerEnv}
                onChange={(e) => setNewServerEnv(e.target.value)}
                placeholder='e.g., {"API_KEY": "your-api-key"}'
                rows={3}
              />
            </div>
            
            <button onClick={handleAddServer} className="add-button">Add Server</button>
          </div>
          
          <div className="mcp-actions">
            <button onClick={saveConfig} className="save-button">Save All Changes</button>
            <button onClick={loadConfig} className="refresh-button">Refresh</button>
          </div>
        </>
      )}
    </div>
  );
};

export default McpSettings;
