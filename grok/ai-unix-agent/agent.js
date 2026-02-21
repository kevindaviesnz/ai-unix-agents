// agent.js (ReAct loop logic)
const OpenAI = require('openai');
const { getTools } = require('./tools');
const { executeCommand } = require('./executor');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_ITERATIONS = 10;
let totalTokens = 0;

async function runAgent(goal, dryRun = false) {
  const tools = getTools();
  let messages = [
    { role: 'system', content: 'You are a codebase health checker AI. Use tools to analyze the codebase step-by-step. Reason, act with one tool, observe, repeat until done. End with a final summary when goal is achieved.' },
    { role: 'user', content: goal }
  ];
  let observations = '';

  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    console.log(`[Iteration ${i}] Reasoning:`);
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools: tools.map(tool => ({ type: 'function', function: tool })),
      tool_choice: 'auto'
    });

    totalTokens += (response.usage?.completion_tokens || 0) + (response.usage?.prompt_tokens || 0);
    console.log(`[Iteration ${i}] Tokens used: ${response.usage?.total_tokens} (completion: ${response.usage?.completion_tokens}, prompt: ${response.usage?.prompt_tokens})`);

    const message = response.choices[0].message;
    console.log(message.content);
    messages.push(message);

    if (message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        const funcName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        console.log(`[Iteration ${i}] Action: Calling tool '${funcName}' with params ${JSON.stringify(args)}`);

        let output;
        try {
          output = await executeCommand(funcName, args, dryRun);
        } catch (err) {
          output = `Error: ${err.message}`;
        }

        console.log(`[Iteration ${i}] Observation: ${output}`);
        messages.push({ role: 'tool', tool_call_id: toolCall.id, name: funcName, content: output });
        observations += output + '\n';
      }
    } else if (message.content.includes('Final summary:')) {
      console.log(`Total tokens used: ${totalTokens}`);
      return message.content;
    }
  }

  console.log(`Total tokens used: ${totalTokens}`);
  return 'Max iterations reached. Partial observations: ' + observations;
}

module.exports = { runAgent };
