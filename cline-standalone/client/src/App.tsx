import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import WelcomeView from './components/welcome/WelcomeView';
import SettingsView from './components/settings/SettingsView';
import ChatView from './components/chat/ChatView';
import { AppContextProvider } from './context/AppContext';
import './App.css';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    // Setup Socket.IO connection
    const socketInstance = io('http://localhost:8080');
    
    socketInstance.on('connect', () => {
      console.log('Connected to server');
      setConnectionError(null);
    });
    
    socketInstance.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnectionError('Failed to connect to server. Please make sure the server is running.');
    });
    
    socketInstance.on('error', (error) => {
      console.error('Socket error:', error);
    });
    
    setSocket(socketInstance);
    
    // Cleanup on unmount
    return () => {
      socketInstance.disconnect();
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
            <Route path="/chat" element={<ChatView />} />
          </Routes>
        </div>
      </Router>
    </AppContextProvider>
  );
}

export default App;
