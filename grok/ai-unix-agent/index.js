// index.js (Main entry point)
const { runAgent } = require('./agent');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 <goal> [options]')
  .demandCommand(1)
  .option('dry-run', {
    alias: 'd',
    type: 'boolean',
    description: 'Run in dry-run mode (simulate commands)',
    default: false
  })
  .argv;

const goal = argv._[0];
const dryRun = argv.dryRun;

console.log(`[Agent] Starting ReAct loop for goal: ${goal}`);
runAgent(goal, dryRun)
  .then(finalOutput => {
    console.log(`[Agent] Goal completed. Final report: ${finalOutput}`);
  })
  .catch(err => {
    console.error(`[Agent] Error: ${err.message}`);
  });
