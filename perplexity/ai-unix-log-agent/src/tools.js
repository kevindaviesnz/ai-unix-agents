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
  return runCommand('bash', ['-lc', 'echo "$1" | sort | uniq -c'], { input: text });
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

// OpenAI tools format
const openaiTools = [
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

// Gemini tools format
const geminiTools = [
  {
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
  },
  {
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
  },
  {
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
  },
  {
    name: 'count_unique_patterns',
    description: 'Count unique lines in given text using sort | uniq -c',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string' }
      },
      required: ['text']
    }
  },
  {
    name: 'disk_usage',
    description: 'Check disk usage (df -h) for a path',
    parameters: {
      type: 'object',
      properties: {
        path: {
