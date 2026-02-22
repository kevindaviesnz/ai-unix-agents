import { z } from 'zod';
import { tool } from '@langchain/core/tools';

const allowedCommands = new Set(['grep', 'awk', 'find', 'sort', 'uniq', 'wc', 'df', 'ps', 'head', 'tail', 'cat']);

export const unixTools = [
  tool(async ({ command, args = [], input }) => {
    // Placeholder; actual exec in executor
    return `Dry run: ${command} ${args.join(' ')}`;
  }, {
    name: 'run_unix',
    description: 'Run a Unix command for log analysis. Use only allowed: grep,awk,find,sort,uniq,wc,df,ps,head,tail,cat.',
    schema: z.object({
      command: z.enum(['grep','awk','find','sort','uniq','wc','df','ps','head','tail','cat']),
      args: z.array(z.string()).default([]),
      input: z.string().optional().describe('Pipe input data')
    })
  })
];
