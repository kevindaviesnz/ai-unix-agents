import { program } from 'commander';
import { runAgent } from './agent.js';
import fs from 'fs';
import path from 'path';

program
  .argument('[goal]', 'Analysis goal')
  .option('-f, --file <path>', 'Log file', './sample.log')
  .option('--dry-run', 'Show commands without executing')
  .parse();

const goal = program.args[0] || 'Summarize errors and disk usage';
const options = program.opts();
const logFile = options.file;  // Fixed: use options.file, not program.opts().file

// Check if log file exists
if (!fs.existsSync(logFile)) {
  console.error(`❌ Log file not found: ${logFile}`);
  console.log('💡 Create it:');
  console.log(`cat > ${logFile} << 'EOF'`);
  console.log(`2026-02-23 08:00 ERROR 192.168.1.100 "login failed"`);
  console.log(`2026-02-23 08:01 ERROR 10.0.0.5 "db timeout"`);
  console.log(`EOF`);
  process.exit(1);
}

// Set LOG_DIR for Unix commands
process.env.LOG_DIR = path.dirname(path.resolve(logFile));

console.log(`📊 Log file: ${logFile}`);
console.log(`🎯 Goal: "${goal}"\n`);

try {
  const result = await runAgent(goal, options);
  console.log('\n✅ Final Analysis:', result);
} catch (error) {
  console.error('❌ Agent failed:', error.message);
}
