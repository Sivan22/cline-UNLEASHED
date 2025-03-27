/**
 * Types and utilities for handling assistant messages
 */

export interface ToolUse {
  type: 'tool_use';
  name: string;
  params: Record<string, any>;
  content?: string;
  id?: string;
  partial?: boolean;
}

export interface TextBlock {
  type: 'text';
  content: string;
  partial?: boolean;
}

export type AssistantMessageContent = TextBlock | ToolUse;

/**
 * Parse assistant message text into content blocks
 */
export function parseAssistantMessage(text: string): AssistantMessageContent[] {
  const blocks: AssistantMessageContent[] = [];
  const lines = text.split('\n');
  
  let currentBlock: AssistantMessageContent | null = null;
  let collectingToolParams = false;
  let toolName = '';
  let toolParams: Record<string, any> = {};
  let paramName = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for tool tags
    const toolStartMatch = line.match(/<([a-zA-Z_][a-zA-Z0-9_]*)>$/);
    const toolEndMatch = line.match(/^<\/([a-zA-Z_][a-zA-Z0-9_]*)>$/);
    const paramStartMatch = line.match(/<([a-zA-Z_][a-zA-Z0-9_]*)>$/);
    const paramEndMatch = line.match(/^<\/([a-zA-Z_][a-zA-Z0-9_]*)>$/);
    
    if (toolStartMatch && !collectingToolParams) {
      // Start of a tool
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      
      toolName = toolStartMatch[1];
      toolParams = {};
      collectingToolParams = true;
      currentBlock = null;
    } else if (toolEndMatch && collectingToolParams && toolEndMatch[1] === toolName) {
      // End of a tool
      blocks.push({
        type: 'tool_use',
        name: toolName,
        params: toolParams,
        partial: false
      });
      
      collectingToolParams = false;
      currentBlock = null;
    } else if (collectingToolParams && paramStartMatch) {
      // Start of a parameter
      paramName = paramStartMatch[1];
      toolParams[paramName] = '';
    } else if (collectingToolParams && paramEndMatch && paramEndMatch[1] === paramName) {
      // End of a parameter
      paramName = '';
    } else if (collectingToolParams && paramName) {
      // Collecting parameter content
      toolParams[paramName] += line + '\n';
    } else {
      // Regular text
      if (!currentBlock || currentBlock.type !== 'text') {
        currentBlock = {
          type: 'text',
          content: line,
          partial: true
        };
      } else {
        currentBlock.content += '\n' + line;
      }
    }
  }
  
  // Add the last block if it exists
  if (currentBlock) {
    if (currentBlock.type === 'text') {
      currentBlock.partial = false;
    }
    blocks.push(currentBlock);
  }
  
  // Clean up parameter values by trimming trailing newlines
  for (const block of blocks) {
    if (block.type === 'tool_use') {
      for (const key in block.params) {
        if (typeof block.params[key] === 'string') {
          block.params[key] = block.params[key].trim();
        }
      }
    }
  }
  
  return blocks;
}
