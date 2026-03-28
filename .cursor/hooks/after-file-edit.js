#!/usr/bin/env node
const { readStdin, runExistingHook, transformToClaude, hookEnabled } = require('./adapter');
readStdin().then(raw => {
  try {
    const input = JSON.parse(raw);
    const claudeInput = transformToClaude(input, {
      tool_input: { file_path: input.path || input.file || '' }
    });
    const claudeStr = JSON.stringify(claudeInput);

    // Run quality-gate, governor-check, console.log warning, and format sequentially
    if (hookEnabled('post:edit:quality-gate', ['standard', 'strict'])) {
      runExistingHook('quality-gate.js', claudeStr);
    }
    if (hookEnabled('post:edit:governor-check', ['standard', 'strict'])) {
      runExistingHook('governor-check.js', claudeStr);
    }
    if (hookEnabled('post:edit:console-warn', ['standard', 'strict'])) {
      runExistingHook('post-edit-console-warn.js', claudeStr);
    }
    if (hookEnabled('post:edit:format', ['strict'])) {
      runExistingHook('post-edit-format.js', claudeStr);
    }
  } catch {}
  process.stdout.write(raw);
}).catch(() => process.exit(0));
