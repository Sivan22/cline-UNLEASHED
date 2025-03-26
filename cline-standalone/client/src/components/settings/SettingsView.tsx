import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import './SettingsView.css';

const SettingsView = () => {
  const { apiConfiguration, updateApiConfiguration } = useAppContext();
  const navigate = useNavigate();
  
  const [formState, setFormState] = useState({
    apiProvider: apiConfiguration.apiProvider,
    apiModelId: apiConfiguration.apiModelId,
    apiKey: apiConfiguration.apiKey,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateApiConfiguration(formState);
    navigate('/chat');
  };

  return (
    <div className="settings-view">
      <div className="settings-header">
        <h1>Settings</h1>
        <button className="back-button" onClick={() => navigate(-1)}>
          Back
        </button>
      </div>

      <form className="settings-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="apiProvider">API Provider</label>
          <select
            id="apiProvider"
            name="apiProvider"
            value={formState.apiProvider}
            onChange={handleChange}
          >
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="openrouter">OpenRouter</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="apiModelId">Model</label>
          <input
            type="text"
            id="apiModelId"
            name="apiModelId"
            value={formState.apiModelId}
            onChange={handleChange}
            placeholder="e.g., claude-3-sonnet-20240229"
          />
        </div>

        <div className="form-group">
          <label htmlFor="apiKey">API Key</label>
          <input
            type="password"
            id="apiKey"
            name="apiKey"
            value={formState.apiKey}
            onChange={handleChange}
            placeholder="Enter your API key"
          />
        </div>

        <button type="submit" className="save-button">
          Save Settings
        </button>
      </form>
    </div>
  );
};

export default SettingsView;
