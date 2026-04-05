import {
  AnthropicResponse,
  AnthropicToolDefinition,
  ConversationMessage,
} from '../types/agentTypes';
import {
  AGENT_MAX_TOKENS,
  AGENT_MODEL,
  ANTHROPIC_PROXY_URL,
  ANTHROPIC_VERSION,
} from '../constants/agentConstants';

/**
 * Call Claude Sonnet via the /anthropic-proxy webpack dev proxy.
 * Uses native fetch (not Axios) to avoid Bahmni's OpenMRS auth interceptors.
 */
export const callClaude = async (
  messages: ConversationMessage[],
  tools: AnthropicToolDefinition[],
  apiKey: string,
  systemPrompt: string,
): Promise<AnthropicResponse> => {
  const response = await fetch(ANTHROPIC_PROXY_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: AGENT_MODEL,
      max_tokens: AGENT_MAX_TOKENS,
      system: systemPrompt,
      tools,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Anthropic API error ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<AnthropicResponse>;
};

/**
 * Extract the first text content block from an Anthropic response, if any.
 */
export const extractTextContent = (response: AnthropicResponse): string => {
  for (const block of response.content) {
    if (block.type === 'text' && block.text) {
      return block.text;
    }
  }
  return '';
};
