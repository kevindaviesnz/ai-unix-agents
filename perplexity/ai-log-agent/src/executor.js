import { spawn } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(require('child_process').exec);

export async function executeUnix({ command, args = [], input, dryRun = false }) {
  if (!allowedCommands.has(command)) throw new Error(`Command ${command} not allowed`);

  // Sanitize args: no shell chars, length limit
  args = args.map(arg => arg.replace(/[;&|`$()]/g, '')).filter(arg => arg.length < 100);

  if (dryRun) return `DRY: ${command} ${args.join(' ')}`;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'pipe', timeout: 30000 });
    let stdout = '', stderr = '';

    child.stdin.write(input || '');
    child.stdin.end();

    child.stdout.on('data', data => stdout += data);
    child.stderr.on('data', data => stderr += data);

    child.on('close', code => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`Exit ${code}: ${stderr}`));
    });

    child.on('error', reject);
  });
}
