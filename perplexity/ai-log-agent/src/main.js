import { program } from 'commander';
import { runAgent } from './agent.js.js';
import fs from 'fs';

program
  .argument('[goal]', 'Analysis goal e.g. "Find top 5 error IPs in logs"')
  .option('-f, --file <path>', 'Log file', './sample.log')
  .option('--dry-run', 'Show commands without exec')
  .parse();

const goal = program.args[0] || 'Summarize errors and disk usage';
const options = program.opts();

if (!fs.existsSync(program.file)) {
  console.error('Create sample.log with demo data');
  process.exit(1);
}

// Set env for log dir
process.env.LOG_DIR = path.dirname(program.file);

const result = await runAgent(goal, options);
console.log('\nFinal Analysis:', result);
