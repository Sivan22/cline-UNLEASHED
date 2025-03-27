import fs from 'fs/promises';
import path from 'path';
import { McpServer } from '../../types/mcp';

export class McpConfigManager {
  private configPath: string;
  
  constructor(configPath: string) {
    this.configPath = configPath;
  }
  
  /**
   * Load MCP server configurations from the config file
   */
  async loadConfig(): Promise<Record<string, McpServer>> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      const config = JSON.parse(configData);
      return config.mcpServers || {};
    } catch (error) {
      // If file doesn't exist, return empty config
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }
  
  /**
   * Save MCP server configurations to the config file
   */
  async saveConfig(mcpServers: Record<string, McpServer>): Promise<void> {
    // Ensure the config directory exists
    const configDir = path.dirname(this.configPath);
    await fs.mkdir(configDir, { recursive: true });
    
    // Write the config file
    await fs.writeFile(
      this.configPath,
      JSON.stringify({ mcpServers }, null, 2),
      'utf8'
    );
  }
  
  /**
   * Add a new server configuration
   */
  async addServer(name: string, config: McpServer): Promise<void> {
    const configs = await this.loadConfig();
    configs[name] = config;
    await this.saveConfig(configs);
  }
  
  /**
   * Remove a server configuration
   */
  async removeServer(name: string): Promise<void> {
    const configs = await this.loadConfig();
    if (configs[name]) {
      delete configs[name];
      await this.saveConfig(configs);
    }
  }
  
  /**
   * Update an existing server configuration
   */
  async updateServer(name: string, config: Partial<McpServer>): Promise<void> {
    const configs = await this.loadConfig();
    if (configs[name]) {
      configs[name] = { ...configs[name], ...config };
      await this.saveConfig(configs);
    } else {
      throw new Error(`MCP server ${name} not found in configuration`);
    }
  }
}
