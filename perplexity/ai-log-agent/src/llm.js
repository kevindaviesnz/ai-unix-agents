import { ChatOpenAI } from '@langchain/openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

export function getLLM() {
  const provider = process.env.LLM_PROVIDER || 'openai';  // 'openai', 'anthropic', 'gemini'
  const model = process.env.LLM_MODEL || 'gpt-4o-mini';

  const systemPrompt = `You are a Unix log analysis expert using ONLY these tools: grep,awk,find,sort,uniq,wc,df,ps,head,tail,cat.
  Goal: {goal}. Follow ReAct: Reason → run_unix → Observe → repeat. Say "ANALYSIS COMPLETE" when done.`;

  if (provider === 'openai') {
    return new ChatOpenAI({ 
      model: model === 'gemini' ? 'gpt-4o-mini' : model, 
      temperature: 0.1 
    });
  } 
  else if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return {
      invoke: async (msgs) => {
        // Simplified tool calling wrapper for Anthropic
        const msg = msgs[msgs.length - 1].content;
        const response = await client.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [{ role: 'user', content: systemPrompt.replace('{goal}', msg) }]
        });
        return { content: [{ type: 'text', text: response.content[0].text }] };
      }
    };
  } 
  else if (provider === 'gemini') {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const modelName = model || 'gemini-1.5-pro';
    
    return {
      invoke: async (messages) => {
        const model = genAI.getGenerativeModel({ model: modelName });
        const chat = model.startChat({
          history: messages.slice(0, -1),
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
        });
        
        const result = await chat.sendMessage(messages[messages.length - 1].content);
        return { content: [{ role: 'model', content: result.response.text() }] };
      },
      // Tool calling simulation for Gemini (function calling)
      callTools: async (args) => {
        return { tool_call_id: '1', args };  // Simplified for demo
      }
    };
  }
  throw new Error(`Unsupported provider: ${provider}. Use: openai, anthropic, gemini`);
}
