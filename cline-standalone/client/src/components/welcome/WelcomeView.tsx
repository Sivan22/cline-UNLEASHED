import { useNavigate } from 'react-router-dom';
import './WelcomeView.css';

const WelcomeView = () => {
  const navigate = useNavigate();

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
            onClick={() => navigate('/chat')}
          >
            Start a New Task
          </button>
          
          <button 
            className="welcome-button" 
            onClick={() => navigate('/settings')}
          >
            Configure Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeView;
