// src/executor.js - Fixed for ES modules
import { spawn } from 'child_process';
import { promisify } from 'util';

const exec = (await import('child_process')).exec;
const execAsync = promisify(exec);

const allowedCommands = new Set(['grep', 'awk', 'find', 'sort', 'uniq', 'wc', 'df', 'ps', 'head', 'tail', 'cat']);

export async function executeUnix({ command, args = [], input, dryRun = false }) {
  if (!allowedCommands.has(command)) {
    throw new Error(`Command "${command}" not allowed. Allowed: ${Array.from(allowedCommands).join(', ')}`);
  }

  // Sanitize args: remove shell injection chars, limit length
  args = args.map(arg => 
    arg.replace(/[;&|`$()<>]/g, '').trim()
  ).filter(arg => arg.length < 100 && arg.length > 0);

  if (dryRun) {
    return `DRY RUN: ${command} ${args.join(' ')}${input ? ` << ${input.slice(0, 50)}...` : ''}`;
  }

  console.log(`🔧 Executing: ${command} ${args.join(' ')}`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { 
      stdio: 'pipe', 
      timeout: 30000,
      shell: false  // Critical: no shell!
    });

    let stdout = '';
    let stderr = '';

    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    }

    child.stdout.on('data', (data) => stdout += data);
    child.stderr.on('data', (data) => stderr += data);

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Command failed (exit ${code}): ${stderr.trim() || 'No stderr'}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Spawn error: ${err.message}`));
    });
  });
}
