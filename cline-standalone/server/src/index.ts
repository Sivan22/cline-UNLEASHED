import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { spawn, ChildProcess } from 'child_process';
import { AgentService } from './services/agent';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../../client/dist')));

// Store client connections and their agent instances
interface Client {
  agentService: AgentService;
  socketId: string;
  workingDirectory: string;
}

const clients = new Map<string, Client>();

// Socket.IO connection handler
io.on('connection', (socket: Socket) => {
  console.log('Client connected:', socket.id);
  
  // Create an agent service for this client
  const workingDirectory = process.cwd(); // Default to server's current directory
  const agentService = new AgentService(workingDirectory);
  
  // Store client information
  clients.set(socket.id, { 
    agentService, 
    socketId: socket.id,
    workingDirectory
  });
  
  // Set up callbacks to stream back to client
  agentService.setCallbacks({
    onText: (text, partial) => {
      socket.emit('streaming_text', { text, partial });
    },
    onToolUse: (toolUse) => {
      socket.emit('tool_use', { 
        tool_name: toolUse.name, 
        tool_params: toolUse.params 
      });
    },
    onToolResult: (result) => {
      socket.emit('tool_result', { result });
    },
    onComplete: () => {
      socket.emit('message_complete');
    }
  });
  
  // Handle client disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    clients.delete(socket.id);
  });
  
  // Handle API configuration update
  socket.on('update_api_config', (config) => {
    const client = clients.get(socket.id);
    if (client) {
      client.agentService.updateConfig(config);
      socket.emit('config_updated', { success: true });
    }
  });
  
  // Handle messages from client
  socket.on('message', async (message: any) => {
    const client = clients.get(socket.id);
    if (!client) return;
    
    try {
      // Process the message with the agent
      socket.emit('status', { processing: true });
      const response = await client.agentService.processMessage(message);
      
      // Send the response back to the client
      socket.emit('message', response);
      socket.emit('status', { processing: false });
    } catch (error: any) {
      console.error('Error processing message:', error);
      socket.emit('error', { 
        message: 'Failed to process message', 
        details: error.message || 'Unknown error' 
      });
      socket.emit('status', { processing: false });
    }
  });
  
  // Handle file operations
  socket.on('read_file', async ({ path: filePath }: { path: string }, callback: Function) => {
    try {
      const client = clients.get(socket.id);
      if (!client) throw new Error('Client not found');
      
      const absolutePath = path.resolve(client.workingDirectory, filePath);
      const content = await fs.readFile(absolutePath, 'utf8');
      callback({ content });
    } catch (error: any) {
      console.error('Error reading file:', error);
      callback({ error: error.message || 'Error reading file' });
    }
  });
  
  socket.on('write_to_file', async ({ path: filePath, content }: { path: string, content: string }, callback: Function) => {
    try {
      const client = clients.get(socket.id);
      if (!client) throw new Error('Client not found');
      
      const absolutePath = path.resolve(client.workingDirectory, filePath);
      
      // Ensure directory exists
      const directory = path.dirname(absolutePath);
      await fs.mkdir(directory, { recursive: true });
      
      // Write file
      await fs.writeFile(absolutePath, content);
      callback({ success: true });
    } catch (error: any) {
      console.error('Error writing file:', error);
      callback({ error: error.message || 'Error writing file' });
    }
  });
  
  socket.on('list_files', async ({ path: dirPath, recursive }: { path: string, recursive?: boolean }, callback: Function) => {
    try {
      const client = clients.get(socket.id);
      if (!client) throw new Error('Client not found');
      
      const absolutePath = path.resolve(client.workingDirectory, dirPath);
      const files = await listFiles(absolutePath, recursive);
      callback({ files });
    } catch (error: any) {
      console.error('Error listing files:', error);
      callback({ error: error.message || 'Error listing files' });
    }
  });
  
  socket.on('search_files', async ({ path: dirPath, pattern }: { path: string, pattern: string }, callback: Function) => {
    try {
      const client = clients.get(socket.id);
      if (!client) throw new Error('Client not found');
      
      const absolutePath = path.resolve(client.workingDirectory, dirPath);
      const results = await searchFiles(absolutePath, pattern);
      callback({ results });
    } catch (error: any) {
      console.error('Error searching files:', error);
      callback({ error: error.message || 'Error searching files' });
    }
  });
  
  socket.on('execute_command', async ({ command }: { command: string }, callback: Function) => {
    try {
      const client = clients.get(socket.id);
      if (!client) throw new Error('Client not found');
      
      executeCommand(
        command, 
        client.workingDirectory,
        (output: string) => {
          socket.emit('command_output', { output });
        }, 
        (error: string) => {
          socket.emit('command_error', { error });
        },
        (code: number | null) => {
          callback({ 
            result: `Command completed with exit code: ${code}` 
          });
        }
      );
    } catch (error: any) {
      console.error('Error executing command:', error);
      callback({ error: error.message || 'Error executing command' });
    }
  });
  
  // Handle setting the working directory
  socket.on('set_working_directory', async ({ directory }: { directory: string }, callback: Function) => {
    try {
      const client = clients.get(socket.id);
      if (!client) throw new Error('Client not found');
      
      // Validate the directory exists
      await fs.access(directory);
      
      // Update the client's working directory
      client.workingDirectory = directory;
      
      // Create a new agent with the updated working directory
      const newAgent = new AgentService(directory);
      
      // Transfer any state/config from the old agent if needed
      // newAgent.updateConfig(client.agentService.getConfig());
      
      // Replace the agent
      client.agentService = newAgent;
      
      // Set callbacks
      client.agentService.setCallbacks({
        onText: (text, partial) => {
          socket.emit('streaming_text', { text, partial });
        },
        onToolUse: (toolUse) => {
          socket.emit('tool_use', { 
            tool_name: toolUse.name, 
            tool_params: toolUse.params 
          });
        },
        onToolResult: (result) => {
          socket.emit('tool_result', { result });
        },
        onComplete: () => {
          socket.emit('message_complete');
        }
      });
      
      callback({ success: true, directory });
    } catch (error: any) {
      console.error('Error setting working directory:', error);
      callback({ error: error.message || 'Error setting working directory' });
    }
  });
});

// Helper functions
async function listFiles(dirPath: string, recursive = false): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    let files: string[] = [];
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory() && recursive) {
        const nestedFiles = await listFiles(fullPath, recursive);
        files = [...files, ...nestedFiles];
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  } catch (error) {
    console.error(`Error listing files in ${dirPath}:`, error);
    throw error;
  }
}

async function searchFiles(dirPath: string, pattern: string): Promise<any[]> {
  // This is a simplified implementation
  // For production, use a proper file search library or command
  const results: any[] = [];
  const files = await listFiles(dirPath, true);
  
  const regex = new RegExp(pattern, 'g');
  
  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          results.push({
            path: file,
            line: i + 1,
            content: lines[i],
            context: lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 3))
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
  
  return results;
}

function executeCommand(
  command: string, 
  cwd: string,
  onOutput: (output: string) => void,
  onError: (error: string) => void,
  onComplete: (code: number | null) => void
): ChildProcess {
  const process = spawn(command, [], { 
    shell: true,
    cwd,
    stdio: 'pipe'
  });
  
  process.stdout.on('data', (data: Buffer) => {
    onOutput(data.toString());
  });
  
  process.stderr.on('data', (data: Buffer) => {
    onError(data.toString());
  });
  
  process.on('close', (code: number | null) => {
    onComplete(code);
  });
  
  return process;
}

// Routes
app.get('*', (req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
