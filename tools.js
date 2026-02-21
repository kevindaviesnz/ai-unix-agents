// tools.js (Tool definitions for LLM)
function getTools() {
  return [
    {
      name: 'find_files',
      description: 'Find files in a directory. Returns list of files.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path (default .)' },
          file_type: { type: 'string', description: 'File type (f for file, d for dir)' },
          name_pattern: { type: 'string', description: 'Name pattern (e.g., *.js)' }
        },
        required: ['path']
      }
    },
    {
      name: 'grep_search',
      description: 'Search for pattern in files.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Search pattern (e.g., TODO)' },
          path: { type: 'string', description: 'File or dir to search' }
        },
        required: ['pattern', 'path']
      }
    },
    {
      name: 'wc_count',
      description: 'Count lines, words, chars in file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          mode: { type: 'string', enum: ['lines', 'words', 'chars'], description: 'What to count' }
        },
        required: ['path', 'mode']
      }
    },
    {
      name: 'du_disk_usage',
      description: 'Get disk usage of path.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to check' },
          summary: { type: 'boolean', description: 'Summarize total' }
        },
        required: ['path']
      }
    },
    {
      name: 'sort_data',
      description: 'Sort lines of input data.',
      parameters: {
        type: 'object',
        properties: {
          data: { type: 'string', description: 'Input data (multiline)' },
          numeric: { type: 'boolean', description: 'Sort numerically' }
        },
        required: ['data']
      }
    },
    {
      name: 'uniq_unique',
      description: 'Remove duplicate lines from input.',
      parameters: {
        type: 'object',
        properties: {
          data: { type: 'string', description: 'Input data' },
          count: { type: 'boolean', description: 'Prefix with count' }
        },
        required: ['data']
      }
    },
    {
      name: 'awk_process',
      description: 'Process text with awk script.',
      parameters: {
        type: 'object',
        properties: {
          script: { type: 'string', description: 'Awk script (e.g., {print $1})' },
          path: { type: 'string', description: 'File path' }
        },
        required: ['script', 'path']
      }
    },
    {
      name: 'ls_list',
      description: 'List files in directory.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path' },
          long: { type: 'boolean', description: 'Long format' }
        },
        required: ['path']
      }
    }
  ];
}

module.exports = { getTools };
