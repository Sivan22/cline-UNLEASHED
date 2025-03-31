// Copied and adapted from src/shared/api.ts

// Define only the providers currently supported or planned for the standalone client
export type ApiProvider =
	| "anthropic"
	| "openrouter"
	| "openai" // For generic OpenAI-compatible endpoints
	// Add others like 'ollama', 'lmstudio' if/when supported

// Keep relevant fields for the supported providers
export interface ApiHandlerOptions {
	apiModelId?: string
	apiKey?: string // Used by Anthropic, OpenAI-compatible, OpenRouter (can be generic)
	anthropicBaseUrl?: string // Specific to Anthropic
	openRouterApiKey?: string // Specific to OpenRouter (if different key needed)
	openRouterModelId?: string // Specific to OpenRouter
	openRouterModelInfo?: ModelInfo // Specific to OpenRouter
	openAiBaseUrl?: string // Specific to OpenAI-compatible
	openAiApiKey?: string // Specific to OpenAI-compatible (if different key needed)
	openAiModelId?: string // Specific to OpenAI-compatible
	openAiModelInfo?: OpenAiCompatibleModelInfo // Specific to OpenAI-compatible
	azureApiVersion?: string // For Azure OpenAI via OpenAI-compatible
	// Add fields for other providers like Ollama, LMStudio if needed
}

export type ApiConfiguration = ApiHandlerOptions & {
	apiProvider?: ApiProvider
}

// Models

export interface ModelInfo {
	maxTokens?: number
	contextWindow?: number
	supportsImages?: boolean
	supportsComputerUse?: boolean // Keep for potential future use
	supportsPromptCache: boolean // Keep for potential future use
	inputPrice?: number
	outputPrice?: number
	cacheWritesPrice?: number // Keep for potential future use
	cacheReadsPrice?: number // Keep for potential future use
	description?: string
}

export interface OpenAiCompatibleModelInfo extends ModelInfo {
	temperature?: number
	isR1FormatRequired?: boolean
}

// Anthropic Models (Keep relevant ones)
export type AnthropicModelId = keyof typeof anthropicModels
export const anthropicDefaultModelId: AnthropicModelId = "claude-3-7-sonnet-20250219"
export const anthropicModels = {
	"claude-3-7-sonnet-20250219": {
		maxTokens: 8192,
		contextWindow: 200_000,
		supportsImages: true,
		supportsComputerUse: true,
		supportsPromptCache: true,
		inputPrice: 3.0,
		outputPrice: 15.0,
		cacheWritesPrice: 3.75,
		cacheReadsPrice: 0.3,
	},
	"claude-3-5-sonnet-20241022": {
		maxTokens: 8192,
		contextWindow: 200_000,
		supportsImages: true,
		supportsComputerUse: true,
		supportsPromptCache: true,
		inputPrice: 3.0,
		outputPrice: 15.0,
		cacheWritesPrice: 3.75,
		cacheReadsPrice: 0.3,
	},
	"claude-3-opus-20240229": {
		maxTokens: 4096,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 15.0,
		outputPrice: 75.0,
		cacheWritesPrice: 18.75,
		cacheReadsPrice: 1.5,
	},
	"claude-3-haiku-20240307": {
		maxTokens: 4096,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 0.25,
		outputPrice: 1.25,
		cacheWritesPrice: 0.3,
		cacheReadsPrice: 0.03,
	},
} as const satisfies Record<string, ModelInfo>

// OpenRouter Default (Keep for reference)
export const openRouterDefaultModelId = "anthropic/claude-3.7-sonnet"
export const openRouterDefaultModelInfo: ModelInfo = {
	maxTokens: 8192,
	contextWindow: 200_000,
	supportsImages: true,
	supportsComputerUse: true,
	supportsPromptCache: true,
	inputPrice: 3.0,
	outputPrice: 15.0,
	cacheWritesPrice: 3.75,
	cacheReadsPrice: 0.3,
	description: "Claude 3.7 Sonnet via OpenRouter.", // Simplified description
}

// OpenAI Compatible Defaults (Keep for reference)
export const openAiModelInfoSaneDefaults: OpenAiCompatibleModelInfo = {
	maxTokens: -1, // Indicate unknown/flexible
	contextWindow: 128_000, // Common default
	supportsImages: false, // Assume false unless configured
	supportsPromptCache: false,
	isR1FormatRequired: false,
	inputPrice: 0,
	outputPrice: 0,
	temperature: 0, // Default temperature
}

// Azure OpenAI Default Version (Keep for reference)
export const azureOpenAiDefaultApiVersion = "2024-08-01-preview"

// Helper function adapted from ApiOptions.tsx
export function normalizeApiConfiguration(apiConfiguration?: ApiConfiguration): {
	selectedProvider: ApiProvider
	selectedModelId: string
	selectedModelInfo: ModelInfo
} {
	const provider = apiConfiguration?.apiProvider || "anthropic" // Default to anthropic
	const modelId = apiConfiguration?.apiModelId

	const getProviderData = (models: Record<string, ModelInfo>, defaultId: string) => {
		let selectedModelId: string
		let selectedModelInfo: ModelInfo
		if (modelId && modelId in models) {
			selectedModelId = modelId
			selectedModelInfo = models[modelId]
		} else {
			selectedModelId = defaultId
			selectedModelInfo = models[defaultId]
		}
		return {
			selectedProvider: provider,
			selectedModelId,
			selectedModelInfo,
		}
	}
	switch (provider) {
		case "anthropic":
			return getProviderData(anthropicModels, anthropicDefaultModelId)
		case "openrouter":
			// Use specific OpenRouter fields if available, otherwise fall back
			return {
				selectedProvider: provider,
				selectedModelId: apiConfiguration?.openRouterModelId || openRouterDefaultModelId,
				selectedModelInfo: apiConfiguration?.openRouterModelInfo || openRouterDefaultModelInfo,
			}
		case "openai":
			// Use specific OpenAI fields if available, otherwise fall back
			return {
				selectedProvider: provider,
				selectedModelId: apiConfiguration?.openAiModelId || "", // No default model ID for generic OpenAI
				selectedModelInfo: apiConfiguration?.openAiModelInfo || openAiModelInfoSaneDefaults,
			}
		// Add cases for other providers like ollama, lmstudio if needed
		default:
			// Fallback to anthropic if provider is unknown
			return getProviderData(anthropicModels, anthropicDefaultModelId)
	}
}
