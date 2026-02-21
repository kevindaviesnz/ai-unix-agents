import { z } from "zod";
import { createUnixTool } from "./tools";

export const lsTool = createUnixTool({
  name: "list_files",
  description: "List files in directory.",
  safetyLevel: "read-only",
  schema: z.object({ path: z.string().optional(), flags: z.string().optional() }),
  command: ({ path, flags }) => ["ls", flags || "-F", path || "."].filter(Boolean),
});

export const psTool = createUnixTool({
  name: "check_processes",
  description: "Check running processes.",
  safetyLevel: "read-only",
  schema: z.object({ grep: z.string().optional() }),
  command: ({ grep }) => ["sh", "-c", grep ? `ps aux | grep ${grep}` : "ps aux"],
});

export const killTool = createUnixTool({
  name: "kill_process",
  description: "Kill a process by PID.",
  safetyLevel: "destructive",
  schema: z.object({ pid: z.string() }),
  command: ({ pid }) => ["kill", "-9", pid],
});
