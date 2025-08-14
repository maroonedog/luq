/**
 * Minimal message factory implementation
 * Provides basic resolveMessage function for reporter.ts
 */

import { MessageFactory, MessageContext } from "./types";

/**
 * Helper to resolve error message from message factory
 */
export function resolveMessage<TContext extends Record<string, any>>(
  messageFactory: MessageFactory<TContext>, 
  context: MessageContext & TContext
): string {
  if (typeof messageFactory === 'function') {
    return messageFactory(context);
  }
  
  // Fallback for simple string or object message factories
  if (typeof messageFactory === 'string') {
    return messageFactory;
  }
  
  // Default fallback message
  return `Validation failed at ${context.path || 'unknown field'}`;
}