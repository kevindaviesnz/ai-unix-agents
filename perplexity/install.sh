#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="ai-unix-log-agent"

echo "Creating project directory: ${PROJECT_NAME}"
mkdir -p "${PROJECT_NAME}/src"

cd "${PROJECT_NAME}"

echo "Initializing npm project..."
npm init -y >/dev/null

echo "Installing dependencies..."
npm install dotenv openai yargs >/dev/null

echo "Writing package.json..."
cat > package.json << 'EOF'
{
  "name": "ai-unix-log-agent",
  "version": "1.0.0",
  "description": "Agentic Node.js demo: Unix commands orchestrated as AI tools to analyze logs.",
  "main": "src/index.js",
  "type": "commonjs",
  "scripts": {
    "start": "node src/index.js",
    "dev": "NODE_ENV=development node src/index.js"
  },
  "dependencies": {
    "dotenv": "^16.4.0",
    "openai": "^4.0.0",
    "yargs": "^17.7.2"
  }
}
EOF

echo "Creating .env.example..."
cat > .env.example << 'EOF'
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
EOF

echo "Creating src/commandExecutor.js..."
cat > src/commandExecutor.js << 'EOF'
const { spawn } = require('child_process');

function runCommand(cmd, args = [], options = {}) {
  const { timeoutMs = 10000, input } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      reject(err);
    });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });

    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

module.exports = { runCommand };
EOF

echo "Creating src/tools.js..."
cat > src/tools.js << 'EOF'
const { runCommand } = require('./commandExecutor');

const MAX_PATH_LEN = 256;
const SAFE_DIR_REGEX = /^[a-zA-Z0-9_./-]+$/;
const SAFE_PATTERN_REGEX = /^[a-zA-Z0-9_:\-\[\]\(\)\/\. ]+$/;

function sanitizePath(path) {
  if (typeof path !== 'string') throw new Error('Path must be a string');
  if (path.length === 0 || path.length > MAX_PATH_LEN) {
    throw new Error('Path length invalid');
  }
  if (!SAFE_DIR_REGEX.test(path)) {
    throw new Error('Path contains invalid characters');
  }
  return path;
}

function sanitizePattern(pattern) {
  if (typeof pattern !== 'string') throw new Error('Pattern must be a string');
  if (pattern.length === 0 || pattern.length > 128) {
    throw new Error('Pattern length invalid');
  }
  if (!SAFE_PATTERN_REGEX.test(pattern)) {
    throw new Error('Pattern contains potentially dangerous characters');
  }
  return pattern;
}

async function listLogs({ directory, maxDepth = 2 }) {
  const dir = sanitizePath(directory);
  const depth = Number.isInteger(maxDepth) ? maxDepth : 2;
  return runCommand('find', [dir, '-maxdepth', String(depth), '-type', 'f']);
}

async function tailFile({ file, lines = 200 }) {
  const path = sanitizePath(file);
  const n = Math.min(Math.max(parseInt(lines, 10) || 50, 1), 1000);
  return runCommand('tail', ['-n', String(n), path]);
}

async function grepErrors({ file, pattern }) {
  const path = sanitizePath(file);
  const pat = sanitizePattern(pattern || 'error');
  return runCommand('grep', ['-i', pat, path]);
}

async function countUniquePatterns({ text }) {
  return runCommand('bash', ['-lc', 'sort | uniq -c'], { input: text });
}

async function diskUsage({ path = '/' }) {
  const p = sanitizePath(path);
  return runCommand('df', ['-h', p]);
}

async function processStats({ pattern = '' }) {
  if (pattern && !SAFE_PATTERN_REGEX.test(pattern)) {
    throw new Error('Invalid pattern');
  }
  const args = ['aux'];
  const result = await runCommand('ps', args);
  if (!pattern) return result;
  const filtered = result.stdout
    .split('\n')
    .filter((line) => line.toLowerCase().includes(pattern.toLowerCase()))
    .join('\n');
  return { ...result, stdout: filtered };
}

async function wordCountLines({ file }) {
  const path = sanitizePath(file);
  return runCommand('wc', ['-l', path]);
}

const toolsSchema = [
  {
    type: 'function',
    function: {
      name: 'list_logs',
      description: 'List log files in a directory up to a certain depth',
      parameters: {
        type: 'object',
        properties: {
          directory: { type: 'string' },
          maxDepth: { type: 'integer' }
        },
        required: ['directory']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tail_file',
      description: 'Tail the last N lines of a file',
      parameters: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          lines: { type: 'integer' }
        },
        required: ['file']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'grep_errors',
      description: 'Search for error patterns in a log file using case-insensitive grep',
      parameters: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          pattern: { type: 'string' }
        },
        required: ['file']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'count_unique_patterns',
      description: 'Count unique lines in given text using sort | uniq -c',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string' }
        },
        required: ['text']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'disk_usage',
      description: 'Check disk usage (df -h) for a path',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'process_stats',
      description: 'Show running processes, optionally filtered by pattern',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'word_count_lines',
      description: 'Count lines in a file (wc -l)',
      parameters: {
        type: 'object',
        properties: {
          file: { type: 'string' }
        },
        required: ['file']
      }
    }
  }
];

const toolImplementations = {
  list_logs: listLogs,
  tail_file: tailFile,
  grep_errors: grepErrors,
  count_unique_patterns: countUniquePatterns,
  disk_usage: diskUsage,
  process_stats: processStats,
  word_count_lines: wordCountLines
};

module.exports = {
  toolsSchema,
  toolImplementations
};
EOF

echo "Creating src/logger.js..."
cat > src/logger.js << 'EOF'
let totalTokens = 0;

function logStep(step) {
  const { iteration, type, message, data } = step;
  const prefix = `[agent#${iteration}] [${type}]`;
  console.log(prefix, message);
  if (data) {
    console.log(prefix, 'data:', JSON.stringify(data, null, 2));
  }
}

function addTokenUsage(usage) {
  if (!usage) return;
  const tokens =
    (usage.input_tokens || 0) +
    (usage.output_tokens || 0) +
    (usage.prompt_tokens || 0) +
    (usage.completion_tokens || 0);
  totalTokens += tokens;
}

function getTokenUsage() {
  return totalTokens;
}

module.exports = {
  logStep,
  addTokenUsage,
  getTokenUsage
};
EOF

echo "Creating src/agent.js..."
cat > src/agent.js << 'EOF'
const OpenAI = require('openai');
const { toolsSchema, toolImplementations } = require('./tools');
const { logStep, addTokenUsage, getTokenUsage } = require('./logger');
require('dotenv').config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function runLogAnalysisAgent({ goal, logDir, maxIterations = 8, dryRun = false }) {
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

  const messages = [
    {
      role: 'system',
      content:
        'You are an AI log analysis agent. Use the available Unix tools to inspect logs, ' +
        'investigate errors, and produce a concise, actionable summary. Think step-by-step. ' +
        'Stop once the goal is achieved or no more useful actions exist.'
    },
    {
      role: 'user',
      content:
        `${goal}\n\n` +
        `The main log directory is: ${logDir}. Focus on recent errors and suspicious patterns.`
    }
  ];

  logStep({ iteration: 0, type: 'reason', message: `Goal: ${goal} (logDir=${logDir})` });

  for (let i = 1; i <= maxIterations; i++) {
    const response = await client.chat.completions.create({
      model,
      messages,
      tools: toolsSchema,
      tool_choice: 'auto'
    });

    const choice = response.choices[0];
    addTokenUsage(response.usage);

    const finishReason = choice.finish_reason;
    const message = choice.message;

    if (finishReason === 'tool_calls' && message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        const functionName = toolCall.function.name;
        const rawArgs = toolCall.function.arguments || '{}';

        let args;
        try {
          args = JSON.parse(rawArgs);
        } catch (e) {
          logStep({
            iteration: i,
            type: 'error',
            message: `Failed to parse tool args for ${functionName}: ${e.message}`
          });
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `Error parsing arguments: ${e.message}`
          });
          continue;
        }

        logStep({
          iteration: i,
          type: 'act',
          message: dryRun
            ? `DRY-RUN: would call ${functionName} with args ${JSON.stringify(args)}`
            : `Calling ${functionName} with args ${JSON.stringify(args)}`
        });

        if (dryRun) {
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `DRY-RUN: simulated response for ${functionName}`
          });
          continue;
        }

        const fn = toolImplementations[functionName];
        if (!fn) {
          const errMsg = `Tool ${functionName} is not implemented`;
          logStep({ iteration: i, type: 'error', message: errMsg });
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: errMsg
          });
          continue;
        }

        try {
          const result = await fn(args);
          const summary = result.stdout.slice(0, 2000);
          logStep({
            iteration: i,
            type: 'observe',
            message: `Tool ${functionName} finished (code=${result.code})`,
            data: { stderr: result.stderr.slice(0, 500) }
          });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              code: result.code,
              stdout: summary,
              stderr: result.stderr.slice(0, 500)
            })
          });
        } catch (err) {
          logStep({
            iteration: i,
            type: 'error',
            message: `Tool ${functionName} threw error: ${err.message}`
          });
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `Error executing tool ${functionName}: ${err.message}`
          });
        }
      }
      continue;
    }

    if (finishReason === 'stop') {
      logStep({
        iteration: i,
        type: 'reason',
        message: 'Model signaled stop; returning final answer.'
      });
      return {
        output: message.content,
        tokens: getTokenUsage()
      };
    }

    logStep({
      iteration: i,
      type: 'error',
      message: `Unexpected finish_reason: ${finishReason}`
    });
    break;
  }

  return {
    output:
      'The agent hit its maximum number of iterations or encountered an unexpected state. ' +
      'Try refining the goal or adjusting maxIterations.',
    tokens: getTokenUsage()
  };
}

module.exports = { runLogAnalysisAgent };
EOF

echo "Creating src/index.js..."
cat > src/index.js << 'EOF'
#!/usr/bin/env node
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const { runLogAnalysisAgent } = require('./agent');
require('dotenv').config();

async function main() {
  const argv = yargs(hideBin(process.argv))
    .usage('$0 [goal]', 'AI-powered Unix log analysis agent', (y) =>
      y
        .positional('goal', {
          describe: 'Natural language goal for the agent',
          type: 'string'
        })
        .option('logDir', {
          alias: 'd',
          type: 'string',
          describe: 'Log directory to analyze',
          default: './logs'
        })
        .option('dry-run', {
          alias: 'n',
          type: 'boolean',
          describe: 'Dry run: show planned commands without executing them',
          default: false
        })
        .option('max-iterations', {
          alias: 'm',
          type: 'number',
          default: 8,
          describe: 'Maximum number of reasoning/tool-calling iterations'
        })
    )
    .help().argv;

  const goal =
    argv.goal ||
    'Review the recent logs and summarize the most common error patterns and whether they indicate an incident.';

  const { output, tokens } = await runLogAnalysisAgent({
    goal,
    logDir: argv.logDir,
    maxIterations: argv['max-iterations'],
    dryRun: argv['dry-run']
  });

  console.log('\n=== FINAL SUMMARY ===\n');
  console.log(output);
  console.log('\n=== RUN STATS ===');
  console.log(`Approx tokens used: ${tokens}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
EOF

echo "Creating README.md..."
cat > README.md << 'EOF'
# AI Unix Log Agent

An example Node.js project that demonstrates **Unix commands orchestrated as AI tools** inside an **agentic ReAct loop**.

The agent uses an LLM with function calling to reason about a log-analysis goal, choose which Unix commands to run, observe their output, and iterate until it produces a final summary.

## Use Case

The agent acts as an **AI-powered log analyzer**. It can:

- Discover log files in a directory (e.g. `/var/log` or `./logs`).
- Tail recent logs and search for error patterns.
- Count unique error messages.
- Optionally check disk usage and process stats for additional context.

This leverages classic Unix tooling (`find`, `tail`, `grep`, `sort`, `uniq`, `wc`, `df`, `ps`) for text-heavy system diagnostics.

## Architecture

- **Reason**: LLM (OpenAI chat model with tools) decides which tool to call next.
- **Act**: Node.js executes the chosen Unix command via `child_process.spawn`.
- **Observe**: The agent captures stdout/stderr, feeds a summary back to the LLM, and repeats.

This implements the ReAct pattern (Reason + Act + Observation) in a loop with a max-iteration cap.

### Files

- `src/index.js` – CLI entry point (parses args, runs the agent).
- `src/agent.js` – ReAct loop and LLM/tool orchestration.
- `src/tools.js` – Tool schemas and Node wrappers around Unix commands.
- `src/commandExecutor.js` – Safe command executor using `spawn` and timeouts.
- `src/logger.js` – Step-wise logging + simple token usage tracker.

## Setup

1. Install dependencies (already done by the bootstrap script), or manually:

   ```bash
   npm install
