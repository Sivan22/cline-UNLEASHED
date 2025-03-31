import { useState, useEffect, useCallback } from 'react';
import WelcomeView from './components/welcome/WelcomeView';
import SettingsView from './components/settings/SettingsView';
import McpSettings from './components/settings/McpSettings';
import ChatView from './components/chat/ChatView';
import { AppContextProvider } from './context/AppContext';
import { socket } from './socket';
import './App.css';

// Define possible views
type View = 'welcome' | 'chat' | 'settings' | 'mcpSettings';

function App() {
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('welcome'); // Default view

  useEffect(() => {
    // Setup Socket.IO connection event listeners
    socket.on('connect', () => {
      console.log('Connected to server');
      setConnectionError(null);
      // If connected and still on welcome, maybe navigate to chat? Or let user decide.
      // For now, stay on welcome until user interaction.
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnectionError('Failed to connect to server. Please make sure the server is running.');
      // Optionally navigate back to welcome or show error prominently
      // setCurrentView('welcome');
    });

    // Cleanup on unmount
    return () => {
      // Remove listeners, but don't disconnect the socket as it's shared
      socket.off('connect');
      socket.off('connect_error');
    };
  }, []);

  // Navigation functions to pass down
  const navigateTo = useCallback((view: View) => {
    setCurrentView(view);
  }, []);

  // Determine if ChatView should be visible or hidden
  const isChatHidden = currentView !== 'chat';

  return (
    <AppContextProvider socket={socket}>
      <div className="app-container">
        {connectionError && (
          <div className="connection-error">
            {connectionError}
          </div>
        )}

        {/* Render views based on state */}
        {currentView === 'welcome' && <WelcomeView navigateTo={navigateTo} />}
        {currentView === 'settings' && <SettingsView navigateTo={navigateTo} />}
        {currentView === 'mcpSettings' && <McpSettings navigateTo={navigateTo} />}

        {/* Always mount ChatView but hide it when not active */}
        <div style={{ display: isChatHidden ? 'none' : 'flex', flexGrow: 1 }}>
          <ChatView navigateTo={navigateTo} />
        </div>

        {/* Basic Footer Navigation Example (can be improved/moved) */}
        {!isChatHidden && (
             <footer style={{ padding: '10px', borderTop: '1px solid #ccc', textAlign: 'center' }}>
                 <button onClick={() => navigateTo('settings')} style={{ marginRight: '10px' }}>Settings</button>
                 {/* Add other navigation buttons as needed */}
             </footer>
         )}
      </div>
    </AppContextProvider>
  );
}

export default App;
