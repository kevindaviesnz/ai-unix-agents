import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { lsTool, psTool, killTool } from "./definedTools";

const llm = new ChatOpenAI({ modelName: "gpt-4o", temperature: 0 });
const tools = [lsTool, psTool, killTool];
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a DevOps assistant. Use tools to diagnose and fix issues."],
  ["placeholder", "{chat_history}"],
  ["human", "{input}"],
  ["placeholder", "{agent_scratchpad}"],
]);

export async function createDevOpsAgent() {
  const agent = await createToolCallingAgent({ llm, tools, prompt });
  return new AgentExecutor({ agent, tools });
}
