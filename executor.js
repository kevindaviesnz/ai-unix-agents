// executor.js (Safe command execution)
const { spawnSync } = require('child_process');

function validatePath(path) {
  if (!path || typeof path !== 'string' || path.includes('..') || path.startsWith('/')) {
    throw new Error('Invalid path: must be relative and not traverse up');
  }
  return path;
}

function executeCommand(toolName, args, dryRun) {
  let cmd, cmdArgs;

  switch (toolName) {
    case 'find_files':
      validatePath(args.path);
      cmd = 'find';
      cmdArgs = [args.path || '.', '-type', args.file_type || 'f'];
      if (args.name_pattern) cmdArgs.push('-name', args.name_pattern);
      break;
    case 'grep_search':
      validatePath(args.path);
      cmd = 'grep';
      cmdArgs = ['-r', args.pattern, args.path];
      break;
    case 'wc_count':
      validatePath(args.path);
      cmd = 'wc';
      const modeFlag = args.mode === 'lines' ? '-l' : args.mode === 'words' ? '-w' : '-c';
      cmdArgs = [modeFlag, args.path];
      break;
    case 'du_disk_usage':
      validatePath(args.path);
      cmd = 'du';
      cmdArgs = [args.path];
      if (args.summary) cmdArgs.unshift('-s');
      break;
    case 'sort_data':
      if (dryRun) return 'Simulated sorted data';
      // For sort/uniq/awk, since they process data, simulate or use echo | sort
      cmd = 'sort';
      cmdArgs = args.numeric ? ['-n'] : [];
      return spawnSync('echo', [args.data], { input: args.data }).stdout.toString().pipe(spawnSync(cmd, cmdArgs).stdin); // Simplified; in real, use pipes
      // Note: For simplicity, using sync spawn with input
      const sortProc = spawnSync(cmd, cmdArgs, { input: args.data, timeout: 5000 });
      if (sortProc.error) throw sortProc.error;
      if (sortProc.status !== 0) throw new Error(sortProc.stderr.toString());
      return sortProc.stdout.toString();
    case 'uniq_unique':
      cmd = 'uniq';
      cmdArgs = args.count ? ['-c'] : [];
      const uniqProc = spawnSync(cmd, cmdArgs, { input: args.data, timeout: 5000 });
      if (uniqProc.error) throw uniqProc.error;
      if (uniqProc.status !== 0) throw new Error(uniqProc.stderr.toString());
      return uniqProc.stdout.toString();
    case 'awk_process':
      validatePath(args.path);
      cmd = 'awk';
      cmdArgs = [args.script, args.path];
      break;
    case 'ls_list':
      validatePath(args.path);
      cmd = 'ls';
      cmdArgs = args.long ? ['-l', args.path] : [args.path];
      break;
    default:
      throw new Error('Unknown tool');
  }

  if (dryRun) {
    return `Dry-run: Would execute '${cmd} ${cmdArgs.join(' ')}'`;
  }

  const proc = spawnSync(cmd, cmdArgs, { timeout: 5000, encoding: 'utf8' });

  if (proc.error) {
    throw proc.error;
  }
  if (proc.status !== 0) {
    throw new Error(`Command failed: ${proc.stderr}`);
  }

  return proc.stdout.trim();
}

module.exports = { executeCommand };
