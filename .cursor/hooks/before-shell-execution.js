#!/usr/bin/env node
const { readStdin, runExistingHook, transformToClaude, hookEnabled } = require('./adapter');

readStdin()
  .then(raw => {
    try {
      const input = JSON.parse(raw || '{}');
      const cmd = String(input.command || input.args?.command || '');

      // SFDX validation
      if (hookEnabled('pre:bash:sfdx-validate', ['standard', 'strict']) && (/\bsf\s/.test(cmd) || /\bsfdx\s/.test(cmd))) {
        const claudeInput = transformToClaude(input, {
          tool_input: { command: cmd }
        });
        claudeInput.tool_name = 'Bash';
        runExistingHook('sfdx-validate.js', JSON.stringify(claudeInput));
      }

      // Git push reminder
      if (hookEnabled('pre:bash:git-push-reminder', ['standard', 'strict']) && /\bgit\s+push\b/.test(cmd)) {
        console.error('[SCC] Review changes before push: git diff origin/main...HEAD');
      }
    } catch {
      // noop
    }

    process.stdout.write(raw);
  })
  .catch(() => process.exit(0));
