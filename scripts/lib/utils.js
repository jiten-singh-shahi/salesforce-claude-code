'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Read a JSON file safely, returning null on error.
 */
function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      process.stderr.write(`[SCC] readJson failed for ${filePath}: ${err.message}\n`);
    }
    return null;
  }
}

/**
 * Check if a file exists.
 */
function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure a directory exists (mkdir -p).
 */
function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Copy a file, creating parent directories as needed.
 */
function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

/**
 * Get the SCC plugin root directory.
 */
function getPluginRoot() {
  return process.env.CLAUDE_PLUGIN_ROOT || process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
}

/**
 * Parse YAML frontmatter from a markdown file.
 * Returns { frontmatter: Object, body: string }.
 *
 * Supports:
 *   - Simple scalars:       key: value
 *   - Quoted strings:       key: "value"  or  key: 'value'
 *   - Booleans:             key: true  /  key: false  (returned as JS boolean)
 *   - Inline arrays:        key: ["a", "b"]  or  key: [a, b]
 *   - Folded block scalar:  key: >-   (multi-line, joined with spaces, trailing newline stripped)
 *   - Folded block scalar:  key: >    (multi-line, joined with spaces, trailing newline kept)
 *   - Literal block scalar: key: |-   (multi-line, newlines preserved, trailing newline stripped)
 *   - Literal block scalar: key: |    (multi-line, newlines preserved, trailing newline kept)
 *
 * The old implementation parsed line-by-line and returned the literal string ">-" for
 * block scalar keys, silently discarding the actual multi-line content. This version
 * collects all indented continuation lines and folds/preserves them correctly.
 */
function parseFrontmatter(content) {
  // Normalise CRLF → LF for Windows compatibility
  const normalised = content.replace(/\r\n/g, '\n');
  const match = normalised.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!match) return { frontmatter: {}, body: content };

  const frontmatter = {};
  const yamlLines = match[1].split('\n');
  let i = 0;

  while (i < yamlLines.length) {
    const line = yamlLines[i];
    const colonIdx = line.indexOf(':');

    // Skip blank lines and lines without a colon
    if (colonIdx === -1 || line.trim() === '') { i++; continue; }

    const key = line.slice(0, colonIdx).trim();
    const raw = line.slice(colonIdx + 1).trim();

    if (!key) { i++; continue; }

    // ── YAML block scalar: >-, >, |-, | ──────────────────────────────────────
    // When the value is a block indicator the actual content is on the
    // following indented lines.
    if (raw === '>-' || raw === '>' || raw === '|-' || raw === '|') {
      const isFolded = raw === '>' || raw === '>-';
      const stripFinal = raw === '>-' || raw === '|-';

      const blockLines = [];
      i++;

      while (i < yamlLines.length) {
        const next = yamlLines[i];
        // Block content: indented with at least one space or tab
        if (next.startsWith(' ') || next.startsWith('\t')) {
          blockLines.push(next.trim());
          i++;
        } else if (next.trim() === '') {
          // Blank lines inside a block scalar are allowed — preserve as paragraph break
          blockLines.push('');
          i++;
        } else {
          break; // Non-indented line signals end of block
        }
      }

      // Remove leading/trailing empty strings caused by blank lines at block edges
      while (blockLines.length > 0 && blockLines[0] === '') blockLines.shift();
      while (blockLines.length > 0 && blockLines[blockLines.length - 1] === '') blockLines.pop();

      let value;
      if (isFolded) {
        // Folded (>): join lines with a single space, collapsing internal whitespace
        value = blockLines
          .join(' ')
          .replace(/\s{2,}/g, ' ')
          .trim();
      } else {
        // Literal (|): preserve newlines exactly
        value = blockLines.join('\n');
        if (stripFinal) value = value.replace(/\n+$/, '');
      }

      frontmatter[key] = value;
      continue;
    }

    // ── Inline array ─────────────────────────────────────────────────────────
    if (raw.startsWith('[') && raw.endsWith(']')) {
      frontmatter[key] = raw
        .slice(1, -1)
        .split(',')
        .map(v => v.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
      i++;
      continue;
    }

    // ── Plain string (remove surrounding quotes) ──────────────────────────────
    // NOTE: true/false are intentionally kept as strings ("true"/"false") for
    // backward compatibility — all existing callers use string comparison.
    // Use parseBool(frontmatter[key]) when you need an actual boolean.
    frontmatter[key] = raw.replace(/^["']|["']$/g, '');
    i++;
  }

  return { frontmatter, body: match[2] };
}

/**
 * Recursively list all files under a directory.
 * Returns an array of absolute paths.
 */
function listFilesRecursive(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

/**
 * Compute a simple hash (used for drift detection).
 * Returns a hex string based on file content length + first 512 bytes.
 */
function simpleHash(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    let hash = buf.length;
    const sample = buf.slice(0, 512);
    for (let i = 0; i < sample.length; i++) {
      hash = ((hash << 5) - hash + sample[i]) & 0xffffffff;
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  } catch {
    return null;
  }
}

/**
 * Read a text file safely, returning null on error.
 */
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      process.stderr.write(`[SCC] readFile failed for ${filePath}: ${err.message}\n`);
    }
    return null;
  }
}

/**
 * Count regex matches in a file.
 */
function countInFile(filePath, pattern) {
  const content = readFile(filePath);
  if (content === null) return 0;

  let regex;
  try {
    if (pattern instanceof RegExp) {
      regex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    } else if (typeof pattern === 'string') {
      regex = new RegExp(pattern, 'g');
    } else {
      return 0;
    }
  } catch {
    return 0;
  }
  const matches = content.match(regex);
  return matches ? matches.length : 0;
}

/**
 * Safely coerce a frontmatter boolean field to a JS boolean.
 *
 * parseFrontmatter returns ALL values as strings for backward compatibility.
 * Use this helper whenever you need an actual boolean from a frontmatter field:
 *
 *   parseBool(frontmatter['user-invocable'])   // → true | false | undefined
 *
 * Returns undefined (not false) when value is absent, so callers can
 * distinguish "not set" from "explicitly false".
 */
function parseBool(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  if (s === 'true') return true;
  if (s === 'false') return false;
  return undefined;
}

/**
 * Serialize a frontmatter object and body back into a markdown string.
 *
 * Multi-line string values (containing \n or longer than 80 chars) are
 * written as YAML folded block scalars (>-) so they round-trip correctly
 * through parseFrontmatter.
 */
function serializeFrontmatter(frontmatter, body) {
  const keys = Object.keys(frontmatter);
  if (keys.length === 0) return body;

  const lines = [];
  for (const key of keys) {
    const value = frontmatter[key];
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map(v => `"${v}"`).join(', ')}]`);
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === 'string' && (value.includes('\n') || value.length > 80)) {
      // Use folded block scalar for long or multi-line strings
      const indented = value
        .split('\n')
        .map(l => `  ${l}`)
        .join('\n');
      lines.push(`${key}: >-\n${indented}`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }

  return `---\n${lines.join('\n')}\n---\n${body}`;
}

/**
 * Log to stderr (visible in Claude Code output, not captured as tool result).
 */
function log(message) {
  console.error(message);
}

module.exports = {
  readJson,
  readFile,
  fileExists,
  ensureDir,
  copyFile,
  getPluginRoot,
  parseFrontmatter,
  parseBool,
  serializeFrontmatter,
  listFilesRecursive,
  simpleHash,
  countInFile,
  log,
};
