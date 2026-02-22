// src/agent.js - Fixed LLM response parsing
import { getLLM } from './llm.js';
import { executeUnix } from './executor.js';

const allowedCommands = new Set(['grep', 'awk', 'find', 'sort', 'uniq', 'wc', 'df', 'ps', 'head', 'tail', 'cat']);

export async function runAgent(goal, options = {}) {
  const llm = getLLM();
  let messages = [{
    role: 'user', 
    content: `GOAL: ${goal}

You are a Unix log analysis expert. Use ONLY these commands: ${Array.from(allowedCommands).join(', ')}.

ReAct pattern:
1. REASON about what Unix command to run next
2. Say: run_unix(command="grep", args=["ERROR"], input="sample.log")
3. OBSERVE the output
4. Repeat until done

Say exactly "ANALYSIS COMPLETE" when finished.`
  }];

  let iterations = 0;
  const maxIterations = 10;

  while (iterations++ < maxIterations) {
    console.log(`\n--- Iteration ${iterations} ---`);
    
    // Reason: Get LLM response
    const response = await llm.invoke(messages);
    
    // Robust parsing for different LLM formats
    let aiContent = '';
    if (typeof response === 'string') {
      aiContent = response;
    } else if (response.content) {
      if (Array.isArray(response.content)) {
        aiContent = response.content.map(c => typeof c === 'string' ? c : c.text || '').join('\n');
      } else {
        aiContent = response.content.text || response.content;
      }
    } else {
      aiContent = String(response);
    }

    const aiMessage = { role: 'assistant', content: aiContent };
    messages.push(aiMessage);
    
    console.log('🤔 Thought:', aiContent.slice(0, 200) + (aiContent.length > 200 ? '...' : ''));

    // Check if done
    if (aiContent.includes('ANALYSIS COMPLETE') || aiContent.includes('COMPLETE')) {
      return aiContent;
    }

    // Act: Parse tool call
    const toolMatch = aiContent.match(/run_unix\s*\(\s*command=["']([^"']+)["']/i);
    if (toolMatch) {
      const command = toolMatch[1];
      const argsMatch = aiContent.match(/args=\s*\[([^\]]*)\]/i);
      const inputMatch = aiContent.match(/input=["']([^"']*)["']/i);
      
      const args = argsMatch ? argsMatch[1].split(',').map(s => s.replace(/["']/g, '').trim()).filter(Boolean) : [];
      const input = inputMatch ? inputMatch[1] : '';

      try {
        console.log(`⚡ Action: ${command} ${args.join(' ')}${input ? ` < ${input}` : ''}`);
        const output = await executeUnix({ command, args, input, dryRun: options.dryRun });
        const observation = { role: 'tool', content: output };
        messages.push(observation);
        console.log('👁️  Observation:', output.slice(0, 300) + (output.length > 300 ? '...' : ''));
      } catch (err) {
        console.log('❌ Tool Error:', err.message);
        messages.push({ role: 'tool', content: `Error: ${err.message}` });
      }
    } else {
      console.log('ℹ️  No tool call found, continuing...');
    }
  }
  
  return 'Max iterations reached. Analysis incomplete.';
}
