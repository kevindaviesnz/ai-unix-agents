import dotenv from "dotenv";
import inquirer from "inquirer";
import { createDevOpsAgent } from "./agent";
dotenv.config();

async function main() {
  console.log("🤖 Agent Ready...");
  const agentExecutor = await createDevOpsAgent();
  while (true) {
    const { userInput } = await inquirer.prompt([{ type: "input", name: "userInput", message: "user >" }]);
    if (userInput.toLowerCase() === "exit") process.exit(0);
    const result = await agentExecutor.invoke({ input: userInput });
    console.log(`\n🤖 Agent: ${result.output}\n`);
  }
}
main();
