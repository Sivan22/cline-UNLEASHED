import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import {
	ApiConfiguration,
	ApiProvider,
	anthropicModels,
	anthropicDefaultModelId,
	openRouterDefaultModelId,
	openRouterDefaultModelInfo,
	openAiModelInfoSaneDefaults,
	normalizeApiConfiguration,
	ModelInfo,
	AnthropicModelId,
	azureOpenAiDefaultApiVersion,
} from '../../shared/api'; // Import shared types and constants
import './SettingsView.css'; // Keep existing CSS for now, may need updates

// Define the props based on the refactored App.tsx
interface SettingsViewProps {
  navigateTo: (view: 'welcome' | 'chat' | 'settings' | 'mcpSettings') => void;
}

const SettingsView = ({ navigateTo }: SettingsViewProps) => {
  const { apiConfiguration: contextApiConfig, updateApiConfiguration } = useAppContext();

  // Local form state, initialized from context
  const [formState, setFormState] = useState<ApiConfiguration>(contextApiConfig);

  // Update local state if context changes (e.g., loaded from storage)
  useEffect(() => {
    setFormState(contextApiConfig);
  }, [contextApiConfig]);

  // Memoize normalized config based on local form state
  const { selectedProvider, selectedModelId, selectedModelInfo } = useMemo(() => {
		return normalizeApiConfiguration(formState);
	}, [formState]);

  // Generic handler for input/select changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    // Handle checkboxes
    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setFormState(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormState(prev => ({ ...prev, [name]: value }));
    }
  };

  // Handler specifically for nested OpenAI model info changes
  const handleOpenAiInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    const field = name as keyof typeof openAiModelInfoSaneDefaults;

    setFormState(prev => {
      const currentInfo = prev.openAiModelInfo || { ...openAiModelInfoSaneDefaults };
      let newValue: string | number | boolean = value;
      if (type === 'checkbox') {
        newValue = checked;
      } else if (field === 'contextWindow' || field === 'maxTokens' || field === 'inputPrice' || field === 'outputPrice') {
         newValue = Number(value) || 0; // Convert to number, default to 0 if invalid
       } else if (field === 'temperature') {
          // Handle temperature potentially needing float parsing
          const parsedValue = parseFloat(value);
          // Ensure newValue is always a number, defaulting to the sane default temperature
          newValue = isNaN(parsedValue) ? (openAiModelInfoSaneDefaults.temperature ?? 0) : parsedValue;
       }

       return {
        ...prev,
        openAiModelInfo: {
          ...currentInfo,
          [field]: newValue,
        }
      };
    });
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateApiConfiguration(formState);
    navigateTo('chat'); // Navigate back to chat view after saving
  };

  // Helper to create dropdown options for models
  const createModelOptions = (models: Record<string, ModelInfo>) => {
    return Object.keys(models).map((modelId) => (
      <option key={modelId} value={modelId}>
        {modelId}
      </option>
    ));
  };

  return (
    <div className="settings-view">
      <div className="settings-header">
        <h1>Settings</h1>
        {/* Use navigateTo prop for back navigation */}
        <button className="back-button" onClick={() => navigateTo('chat')}>
          Back to Chat
        </button>
      </div>

      {/* Basic Nav - Can be improved later */}
      <div className="settings-nav">
        <ul>
          <li className="active"><a href="#api-settings">API Settings</a></li>
          {/* Keep MCP link, using navigateTo */}
          <li><a href="#" onClick={(e) => { e.preventDefault(); navigateTo('mcpSettings'); }}>MCP Servers</a></li>
        </ul>
      </div>

      <form className="settings-form" onSubmit={handleSubmit} id="api-settings">
        <h2>API Configuration</h2>

        {/* API Provider Dropdown */}
        <div className="form-group">
          <label htmlFor="apiProvider">API Provider</label>
          <select
            id="apiProvider"
            name="apiProvider"
            value={selectedProvider} // Use normalized provider
            onChange={handleChange}
          >
            {/* Add supported providers */}
            <option value="anthropic">Anthropic</option>
            <option value="openrouter">OpenRouter</option>
            <option value="openai">OpenAI Compatible</option>
            {/* Add other providers like ollama, lmstudio here when supported */}
          </select>
        </div>

        {/* Conditional Fields based on Provider */}

        {/* Anthropic Settings */}
        {selectedProvider === 'anthropic' && (
          <>
            <div className="form-group">
              <label htmlFor="apiKey">Anthropic API Key</label>
              <input
                type="password"
                id="apiKey"
                name="apiKey"
                value={formState.apiKey || ''}
                onChange={handleChange}
                placeholder="Enter Anthropic API Key..."
              />
            </div>
             <div className="form-group">
                <label htmlFor="anthropicBaseUrl">Custom Base URL (Optional)</label>
                <input
                    type="url"
                    id="anthropicBaseUrl"
                    name="anthropicBaseUrl"
                    value={formState.anthropicBaseUrl || ''}
                    onChange={handleChange}
                    placeholder="Default: https://api.anthropic.com"
                />
            </div>
            <div className="form-group">
              <label htmlFor="apiModelId">Model</label>
              <select
                id="apiModelId"
                name="apiModelId"
                value={selectedModelId} // Use normalized model ID
                onChange={handleChange}
              >
                <option value="">Select a model...</option>
                {createModelOptions(anthropicModels)}
              </select>
            </div>
          </>
        )}

        {/* OpenRouter Settings */}
        {selectedProvider === 'openrouter' && (
          <>
            <div className="form-group">
              <label htmlFor="openRouterApiKey">OpenRouter API Key</label>
              <input
                type="password"
                id="openRouterApiKey"
                name="openRouterApiKey" // Use specific key if needed, else fallback to generic apiKey
                value={formState.openRouterApiKey || formState.apiKey || ''}
                onChange={handleChange}
                placeholder="Enter OpenRouter API Key..."
              />
            </div>
            <div className="form-group">
              <label htmlFor="openRouterModelId">Model ID</label>
              <input
                type="text"
                id="openRouterModelId"
                name="openRouterModelId"
                value={formState.openRouterModelId || ''}
                onChange={handleChange}
                placeholder={`Default: ${openRouterDefaultModelId}`}
              />
               {/* TODO: Add OpenRouter model picker component later */}
               <p className="field-description">Enter any valid OpenRouter model ID.</p>
            </div>
          </>
        )}

        {/* OpenAI Compatible Settings */}
        {selectedProvider === 'openai' && (
          <>
            <div className="form-group">
              <label htmlFor="openAiBaseUrl">Base URL</label>
              <input
                type="url"
                id="openAiBaseUrl"
                name="openAiBaseUrl"
                value={formState.openAiBaseUrl || ''}
                onChange={handleChange}
                placeholder="Enter base URL (e.g., https://api.openai.com/v1)"
              />
            </div>
            <div className="form-group">
              <label htmlFor="openAiApiKey">API Key (Optional)</label>
              <input
                type="password"
                id="openAiApiKey"
                name="openAiApiKey" // Use specific key if needed, else fallback to generic apiKey
                value={formState.openAiApiKey || formState.apiKey || ''}
                onChange={handleChange}
                placeholder="Enter API Key..."
              />
            </div>
            <div className="form-group">
              <label htmlFor="openAiModelId">Model ID</label>
              <input
                type="text"
                id="openAiModelId"
                name="openAiModelId"
                value={formState.openAiModelId || ''}
                onChange={handleChange}
                placeholder="Enter Model ID (e.g., gpt-4o)"
              />
            </div>
             <div className="form-group">
                <label htmlFor="azureApiVersion">Azure API Version (Optional)</label>
                <input
                    type="text"
                    id="azureApiVersion"
                    name="azureApiVersion"
                    value={formState.azureApiVersion || ''}
                    onChange={handleChange}
                    placeholder={`Default: ${azureOpenAiDefaultApiVersion}`}
                />
            </div>
            {/* Basic OpenAI Model Configuration */}
            <details className="form-group">
                <summary>Model Configuration (Optional)</summary>
                <div className="details-content">
                     <div className="form-group checkbox-group">
                        <input
                            type="checkbox"
                            id="openAiSupportsImages"
                            name="supportsImages"
                            checked={formState.openAiModelInfo?.supportsImages ?? openAiModelInfoSaneDefaults.supportsImages}
                            onChange={handleOpenAiInfoChange}
                        />
                        <label htmlFor="openAiSupportsImages">Supports Images</label>
                    </div>
                     <div className="form-group checkbox-group">
                        <input
                            type="checkbox"
                            id="openAiSupportsComputerUse"
                            name="supportsComputerUse"
                            checked={formState.openAiModelInfo?.supportsComputerUse ?? openAiModelInfoSaneDefaults.supportsComputerUse}
                            onChange={handleOpenAiInfoChange}
                        />
                        <label htmlFor="openAiSupportsComputerUse">Supports Computer Use</label>
                    </div>
                     <div className="form-group">
                        <label htmlFor="openAiContextWindow">Context Window</label>
                        <input
                            type="number"
                            id="openAiContextWindow"
                            name="contextWindow"
                            value={formState.openAiModelInfo?.contextWindow ?? openAiModelInfoSaneDefaults.contextWindow}
                            onChange={handleOpenAiInfoChange}
                            placeholder={openAiModelInfoSaneDefaults.contextWindow?.toString()}
                        />
                    </div>
                    {/* Add more fields like maxTokens, prices, temperature if needed */}
                </div>
            </details>
          </>
        )}

        {/* Placeholder for Model Info Display */}
        {selectedProvider !== 'openai' && selectedModelId && (
           <div className="model-info">
             <h4>Model Information ({selectedModelId})</h4>
             <p>Context Window: {selectedModelInfo.contextWindow?.toLocaleString() ?? 'N/A'}</p>
             <p>Max Output Tokens: {selectedModelInfo.maxTokens?.toLocaleString() ?? 'N/A'}</p>
             <p>Supports Images: {selectedModelInfo.supportsImages ? 'Yes' : 'No'}</p>
             {/* Add more info display */}
           </div>
         )}


        <button type="submit" className="save-button">
          Save Settings
        </button>
      </form>
    </div>
  );
};

export default SettingsView;
