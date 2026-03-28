#!/usr/bin/env node
const { readStdin, hookEnabled } = require('./adapter');

readStdin().then(raw => {
  try {
    const input = JSON.parse(raw || '{}');
    const cmd = String(input.command || input.args?.command || '');
    const output = String(input.output || input.result || '');

    if (hookEnabled('post:bash:pr-created', ['standard', 'strict']) && /\bgh\s+pr\s+create\b/.test(cmd)) {
      const m = output.match(/https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/);
      if (m) {
        console.error('[SCC] PR created: ' + m[0]);
        const repo = m[0].replace(/https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/\d+/, '$1');
        const pr = m[0].replace(/.+\/pull\/(\d+)/, '$1');
        console.error('[SCC] To review: gh pr review ' + pr + ' --repo ' + repo);
      }
    }

    if (hookEnabled('post:bash:build-complete', ['standard', 'strict'])) {
      if (/(sf\s+project\s+deploy|sf\s+deploy|sfdx\s+force:source:deploy|npm run build|pnpm build|yarn build)/.test(cmd)) {
        console.error('[SCC] Build/deploy completed — review results above');
      }
    }
  } catch {
    // noop
  }

  process.stdout.write(raw);
}).catch(() => process.exit(0));
