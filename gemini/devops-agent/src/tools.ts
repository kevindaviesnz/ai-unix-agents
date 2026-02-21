import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { execa } from "execa";
import inquirer from "inquirer";

export type SafetyLevel = "read-only" | "destructive";

interface UnixToolOptions<T extends z.ZodObject<any>> {
  name: string;
  description: string;
  schema: T;
  command: (args: z.infer<T>) => string[];
  safetyLevel: SafetyLevel;
}

export function createUnixTool<T extends z.ZodObject<any>>({
  name,
  description,
  schema,
  command,
  safetyLevel,
}: UnixToolOptions<T>) {
  return new DynamicStructuredTool({
    name,
    description: `${description} (Safety: ${safetyLevel})`,
    schema,
    func: async (args) => {
      const cmdParts = command(args);
      const cmdString = cmdParts.join(" ");
      console.log(`\n[Agent Plan] Executing: \x1b[36m${cmdString}\x1b[0m`);
      if (safetyLevel === "destructive") {
        const { confirm } = await inquirer.prompt([{
            type: "confirm",
            name: "confirm",
            message: `⚠️  Allow destructive command: "${cmdString}"?`,
            default: false,
        }]);
        if (!confirm) return "Action denied by user.";
      }
      try {
        const { stdout, stderr } = await execa(cmdParts[0], cmdParts.slice(1));
        return stderr ? `stderr: ${stderr}` : (stdout || "Success");
      } catch (error: any) {
        return `Error: ${error.message}`;
      }
    },
  });
}
