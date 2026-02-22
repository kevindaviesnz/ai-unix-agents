// src/llm.js - Fixed for all providers including Gemini
import dotenv from 'dotenv';
dotenv.config();

import { ChatOpenAI } from '@langchain/openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

export function getLLM() {
  const provider = process.env.LLM_PROVIDER || 'openai';

  if (provider === 'openai') {
    return new ChatOpenAI({ 
      model: process.env.LLM_MODEL || 'gpt-4o-mini', 
      temperature: 0.1 
    });
  } 
  else if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return {
      invoke: async (messages) => {
        const lastMsg = messages[messages.length - 1];
        const response = await client.messages.create({
          model: process.env.LLM_MODEL || 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [{ role: 'user', content: lastMsg.content }]
        });
        return { content: [{ type: 'text', text: response.content[0].text }] };
      }
    };
  } 
  else if (provider === 'gemini') {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const modelName = process.env.LLM_MODEL || 'gemini-1.5-flash';
    
    return {
      invoke: async (messages) => {
        // Convert OpenAI-style messages to Gemini format
        const history = messages.slice(0, -1).map(msg => ({
          role: msg.role === 'user' ? 'user' : msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: typeof msg.content === 'string' ? msg.content : String(msg.content) }]
        }));

        const model = genAI.getGenerativeModel({ model: modelName });
        const chat = model.startChat({
          history,
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
        });
        
        const result = await chat.sendMessage(messages[messages.length - 1].content);
        return { 
          content: [{ 
            role: 'model', 
            text: result.response.text() 
          }] 
        };
      }
    };
  }
  throw new Error(`Unsupported provider: ${provider}`);
}
