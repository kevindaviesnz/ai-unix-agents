// src/agent.js - Complete Production-Ready ReAct Agent
// MacOS-compatible Unix command orchestrator with full conversation memory

import { getLLM } from './llm.js';
import { executeUnix } from './executor.js';

const allowedCommands = new Set([
  'grep', 'awk', 'find', 'sort', 'uniq', 'wc', 'df', 'ps', 'head', 'tail', 'cat', 'du'
]);

export async function runAgent(goal, options = {}) {
  const llm = getLLM();
  
  let messages = [{
    role: 'user', 
    content: `GOAL: ${goal}

CRITICAL: You are a Unix/MacOS system analysis expert. Use ONLY these whitelisted commands:
${Array.from(allowedCommands).join(', ')}

ReAct pattern (Reason → Act → Observe → Repeat):
1. REASON: Think what Unix command solves next step
2. ACT: Output EXACTLY: run_unix(command="ps", args=["aux"], input="") 
3. OBSERVE: Read my observation of command output
4. Repeat until goal achieved

MacOS tips:
- ps aux shows ALL processes (grep shows itself - use grep '[V]ideo' trick)
- No /proc filesystem - use 'ps -p PID -o command' instead
- df -h for human-readable disk
- du -sh * | sort -hr for largest files

Say EXACTLY "ANALYSIS COMPLETE" when finished with final answer.

Current step:`
  }];

  let iterations = 0;
  const maxIterations = 10;

  while (iterations++ < maxIterations) {
    console.log(`\n--- Iteration ${iterations} ---`);
    
    // Reason: Get LLM response (AI call #N)
    const response = await llm.invoke(messages);
    
    // Robust parsing for different LLM response formats
    let aiContent = '';
    if (typeof response === 'string') {
      aiContent = response;
    } else if (response.content) {
      if (Array.isArray(response.content)) {
        aiContent = response.content
          .map(c => typeof c === 'string' ? c : c.text || c.content || '')
          .join('\n');
      } else {
        aiContent = response.content.text || response.content.content || response.content;
      }
    } else {
      aiContent = String(response);
    }

    const aiMessage = { role: 'assistant', content: aiContent };
    messages.push(aiMessage);
    
    console.log('🤔 Thought:', aiContent.slice(0, 200) + (aiContent.length > 200 ? '...' : ''));

    // Check if analysis complete
    if (aiContent.includes('ANALYSIS COMPLETE') || aiContent.includes('COMPLETE')) {
      return extractFinalAnswer(aiContent);
    }

    // Act: Parse tool call from AI reasoning
    const toolMatch = aiContent.match(/run_unix\s*\(\s*command=["']([^"']+)["']/i);
    if (toolMatch) {
      const command = toolMatch[1];
      
      // Parse args array: args=["aux", "-v"]
      const argsMatch = aiContent.match(/args\s*=\s*\[\s*([^\]]*)\s*\]/i);
      const args = argsMatch ? 
        argsMatch[1].split(',').map(s => s.replace(/["']/g, '').trim()).filter(Boolean) : 
        [];
      
      // Parse input pipe: input="sample.log"
      const inputMatch = aiContent.match(/input\s*=\s*["']([^"']*)["']/i);
      const input = inputMatch ? inputMatch[1] : '';

      try {
        console.log(`⚡ Action: ${command} ${args.join(' ')}${input ? ` < ${input}` : ''}`);
        const output = await executeUnix({ command, args, input, dryRun: options.dryRun });
        
        const observation = { 
          role: 'tool', 
          content: `OBSERVATION:\n\`\`\`\n${output}\n\`\`\`` 
        };
        messages.push(observation);
        
        console.log('👁️  Observation:', output.slice(0, 300) + (output.length > 300 ? '...' : ''));
      } catch (err) {
        console.log('❌ Tool Error:', err.message);
        messages.push({ 
          role: 'tool', 
          content: `ERROR: ${err.message}\n\nContinue reasoning with this error.` 
        });
      }
    } else {
      console.log('ℹ️  No tool call detected, continuing to next iteration...');
    }
  }
  
  return 'Max iterations (10) reached. Analysis incomplete. Try simpler query.';
}

function extractFinalAnswer(content) {
  // Extract final analysis after "ANALYSIS COMPLETE"
  const finalMatch = content.match(/ANALYSIS COMPLETE(.*)$/s);
  if (finalMatch) {
    return finalMatch[1].trim() || content;
  }
  return content;
}
