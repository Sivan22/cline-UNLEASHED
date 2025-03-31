import './WelcomeView.css';

interface WelcomeViewProps {
  navigateTo: (view: 'welcome' | 'chat' | 'settings' | 'mcpSettings') => void;
}

const WelcomeView = ({ navigateTo }: WelcomeViewProps) => {

  return (
    <div className="welcome-view">
      <div className="welcome-content">
        <h1>Welcome to Cline Standalone</h1>
        <p>
          Cline is an autonomous coding agent capable of creating and editing files,
          running commands, and more. This is a standalone version that works in your browser.
        </p>
        
        <div className="welcome-buttons">
          <button 
            className="welcome-button primary" 
            onClick={() => navigateTo('chat')}
          >
            Start a New Task
          </button>
          
          <button 
            className="welcome-button" 
            onClick={() => navigateTo('settings')}
          >
            Configure Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeView;
