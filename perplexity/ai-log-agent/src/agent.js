import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { unixTools } from './tools.js';
import { getLLM } from './llm.js';
import { executeUnix } from './executor.js';

const llm = getLLM();

export async function runAgent(goal, options = {}) {
  const agent = createReactAgent({ llm, tools: unixTools });
  let state = { messages: [{ role: 'user', content: goal }] };
  let iterations = 0;
  const maxIterations = 10;

  while (iterations++ < maxIterations) {
    console.log(`\n--- Iteration ${iterations} ---`);
    const result = await agent.invoke(state, { configurable: { thread_id: '1' } });
    state = result;

    const lastMsg = state.messages[state.messages.length - 1];
    if (lastMsg.content.includes('done') || lastMsg.role === 'ai') break;

    // Execute tool
    const toolCall = lastMsg.tool_calls?.[0];
    if (toolCall) {
      try {
        const output = await executeUnix({ ...toolCall.args, dryRun: options.dryRun });
        state.messages.push({ role: 'tool', content: output, tool_call_id: toolCall.id });
        console.log('Observation:', output.slice(0, 500) + '...');
      } catch (err) {
        state.messages.push({ role: 'tool', content: `Error: ${err.message}` });
      }
    }
  }
  return state.messages.slice(-1)[0].content;
}
