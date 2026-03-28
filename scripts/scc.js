#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const COMMANDS = {
  install: { script: 'cli/install-apply.js', description: 'Install SCC content into a supported target (apex, lwc, all)' },
  plan: { script: 'dev/install-plan.js', description: 'Inspect selective-install manifests' },
  'list-installed': { script: 'dev/list-installed.js', description: 'List currently installed SCC content' },
  doctor: { script: 'dev/doctor.js', description: 'Diagnose missing or drifted files' },
  repair: { script: 'dev/repair.js', description: 'Restore drifted files' },
  status: { script: 'dev/status.js', description: 'Query JSON state store' },
  sessions: { script: 'dev/sessions-cli.js', description: 'List or inspect sessions' },
  'session-inspect': { script: 'dev/session-inspect.js', description: 'Emit canonical SCC session snapshots from dmux or Claude history targets' },
  uninstall: { script: 'cli/uninstall.js', description: 'Remove SCC-managed files' },
};

const PRIMARY_COMMANDS = ['install', 'plan', 'list-installed', 'doctor', 'repair', 'status', 'sessions', 'session-inspect', 'uninstall'];

function showHelp(exitCode = 0) {
  console.log(`
SCC — Salesforce Claude Code CLI

Usage:
  scc <command> [args...]
  scc [install args...]

Commands:
${PRIMARY_COMMANDS.map(cmd => `  ${cmd.padEnd(18)} ${COMMANDS[cmd].description}`).join('\n')}

Compatibility:
  scc [args...]      Without a command, args are routed to "install"
  scc help <command> Show help for a specific command

Install targets:
  apex              Install Apex development content
  lwc               Install LWC development content
  all               Install everything

Install profiles:
  --profile apex       Apex development suite (core + apex + platform + devops + security)
  --profile lwc        LWC development suite (core + lwc + platform + devops + security)
  --profile full       Complete suite — all 7 bundles (default)

Examples:
  scc apex
  scc all
  scc install --config scc-install.json
  scc install --profile apex --target claude
  scc plan --config scc-install.json --target cursor
  scc doctor
  scc repair --dry-run
  scc status --json
  scc sessions
  scc session-inspect claude:latest
  scc uninstall --dry-run

Environment:
  SCC_HOOK_PROFILE    Hook profile: minimal | standard | strict
  SCC_DISABLED_HOOKS  Comma-separated list of hooks to disable
  SF_ORG_ALIAS        Default Salesforce org alias

Documentation: https://github.com/jiten/salesforce-claude-code
`);
  process.exit(exitCode);
}

function resolveCommand(argv) {
  const args = argv.slice(2);
  if (args.length === 0) return { mode: 'help' };

  const [firstArg, ...restArgs] = args;

  if (firstArg === '--help' || firstArg === '-h') return { mode: 'help' };
  if (firstArg === '--version' || firstArg === '-v') return { mode: 'version' };

  if (firstArg === 'help') {
    return { mode: 'help-command', command: restArgs[0] || null };
  }

  if (COMMANDS[firstArg]) {
    return { mode: 'delegate', command: firstArg, args: restArgs };
  }

  // Treat as install target shorthand
  return { mode: 'delegate', command: 'install', args };
}

function runCommand(commandName, args) {
  const command = COMMANDS[commandName];
  if (!command) {
    throw new Error(`Unknown command: ${commandName}`);
  }

  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, command.script), ...args],
    {
      cwd: process.cwd(),
      env: { ...process.env, CLAUDE_PLUGIN_ROOT: path.join(__dirname, '..'), SCC_PLUGIN_ROOT: path.join(__dirname, '..') },
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (typeof result.status === 'number') {
    return result.status;
  }

  if (result.signal) {
    throw new Error(`Command "${commandName}" terminated by signal ${result.signal}`);
  }

  return 1;
}

function main() {
  try {
    const resolved = resolveCommand(process.argv);

    if (resolved.mode === 'help') {
      showHelp(0);
    }

    if (resolved.mode === 'version') {
      const pkg = require('../package.json');
      console.log(pkg.version);
      process.exit(0);
    }

    if (resolved.mode === 'help-command') {
      if (!resolved.command) {
        showHelp(0);
      }

      if (!COMMANDS[resolved.command]) {
        throw new Error(`Unknown command: ${resolved.command}`);
      }

      process.exitCode = runCommand(resolved.command, ['--help']);
      return;
    }

    process.exitCode = runCommand(resolved.command, resolved.args);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
