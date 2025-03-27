import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Socket } from 'socket.io-client';
import WelcomeView from './components/welcome/WelcomeView';
import SettingsView from './components/settings/SettingsView';
import McpSettings from './components/settings/McpSettings';
import ChatView from './components/chat/ChatView';
import { AppContextProvider } from './context/AppContext';
import { socket } from './socket';
import './App.css';

function App() {
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    // Setup Socket.IO connection event listeners
    socket.on('connect', () => {
      console.log('Connected to server');
      setConnectionError(null);
    });
    
    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnectionError('Failed to connect to server. Please make sure the server is running.');
    });
    
    // Cleanup on unmount
    return () => {
      // Remove listeners, but don't disconnect the socket as it's shared
      socket.off('connect');
      socket.off('connect_error');
    };
  }, []);

  return (
    <AppContextProvider socket={socket}>
      <Router>
        <div className="app-container">
          {connectionError && (
            <div className="connection-error">
              {connectionError}
            </div>
          )}
          
          <Routes>
            <Route path="/" element={<WelcomeView />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="/settings/mcp" element={<McpSettings />} />
            <Route path="/chat" element={<ChatView />} />
          </Routes>
        </div>
      </Router>
    </AppContextProvider>
  );
}

export default App;
