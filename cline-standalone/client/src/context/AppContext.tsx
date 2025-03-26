import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Socket } from 'socket.io-client';
import { Message, ApiConfiguration, TaskHistory } from '../types';

interface AppContextType {
  messages: Message[];
  isLoading: boolean;
  addMessage: (message: Message) => void;
  clearMessages: () => void;
  apiConfiguration: ApiConfiguration;
  updateApiConfiguration: (config: Partial<ApiConfiguration>) => void;
  taskHistory: TaskHistory[];
  isExecutingTool: boolean;
  executeCommand: (command: string) => Promise<string>;
  readFile: (path: string) => Promise<string>;
  writeToFile: (path: string, content: string) => Promise<void>;
  searchFiles: (path: string, pattern: string) => Promise<any[]>;
  listFiles: (path: string, recursive?: boolean) => Promise<string[]>;
}

const defaultApiConfiguration: ApiConfiguration = {
  apiProvider: 'anthropic',
  apiModelId: 'claude-3-sonnet-20240229',
  apiKey: '',
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider: React.FC<{
  children: ReactNode;
  socket: Socket | null;
}> = ({ children, socket }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiConfiguration, setApiConfiguration] = useState<ApiConfiguration>(
    () => {
      const savedConfig = localStorage.getItem('apiConfiguration');
      return savedConfig ? JSON.parse(savedConfig) : defaultApiConfiguration;
    }
  );
  const [taskHistory, setTaskHistory] = useState<TaskHistory[]>(
    () => {
      const savedHistory = localStorage.getItem('taskHistory');
      return savedHistory ? JSON.parse(savedHistory) : [];
    }
  );
  const [isExecutingTool, setIsExecutingTool] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('apiConfiguration', JSON.stringify(apiConfiguration));
  }, [apiConfiguration]);

  useEffect(() => {
    localStorage.setItem('taskHistory', JSON.stringify(taskHistory));
  }, [taskHistory]);

  useEffect(() => {
    if (!socket) return;

    socket.on('message', (newMessage: Message) => {
      setMessages(prev => [...prev, newMessage]);
    });

    socket.on('tool_result', (result) => {
      setIsExecutingTool(false);
    });

    return () => {
      socket.off('message');
      socket.off('tool_result');
    };
  }, [socket]);

  const addMessage = (message: Message) => {
    setMessages(prev => [...prev, message]);
    if (socket) {
      socket.emit('message', message);
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const updateApiConfiguration = (config: Partial<ApiConfiguration>) => {
    setApiConfiguration(prev => ({ ...prev, ...config }));
  };

  const executeCommand = async (command: string): Promise<string> => {
    if (!socket) throw new Error('Socket not connected');
    
    setIsExecutingTool(true);
    return new Promise((resolve, reject) => {
      socket.emit('execute_command', { command }, (response: any) => {
        setIsExecutingTool(false);
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response.result);
        }
      });
    });
  };

  const readFile = async (path: string): Promise<string> => {
    if (!socket) throw new Error('Socket not connected');
    
    setIsExecutingTool(true);
    return new Promise((resolve, reject) => {
      socket.emit('read_file', { path }, (response: any) => {
        setIsExecutingTool(false);
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response.content);
        }
      });
    });
  };

  const writeToFile = async (path: string, content: string): Promise<void> => {
    if (!socket) throw new Error('Socket not connected');
    
    setIsExecutingTool(true);
    return new Promise((resolve, reject) => {
      socket.emit('write_to_file', { path, content }, (response: any) => {
        setIsExecutingTool(false);
        if (response.error) {
          reject(response.error);
        } else {
          resolve();
        }
      });
    });
  };

  const searchFiles = async (path: string, pattern: string): Promise<any[]> => {
    if (!socket) throw new Error('Socket not connected');
    
    setIsExecutingTool(true);
    return new Promise((resolve, reject) => {
      socket.emit('search_files', { path, pattern }, (response: any) => {
        setIsExecutingTool(false);
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response.results);
        }
      });
    });
  };

  const listFiles = async (path: string, recursive = false): Promise<string[]> => {
    if (!socket) throw new Error('Socket not connected');
    
    setIsExecutingTool(true);
    return new Promise((resolve, reject) => {
      socket.emit('list_files', { path, recursive }, (response: any) => {
        setIsExecutingTool(false);
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response.files);
        }
      });
    });
  };

  return (
    <AppContext.Provider
      value={{
        messages,
        isLoading,
        addMessage,
        clearMessages,
        apiConfiguration,
        updateApiConfiguration,
        taskHistory,
        isExecutingTool,
        executeCommand,
        readFile,
        writeToFile,
        searchFiles,
        listFiles,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};
