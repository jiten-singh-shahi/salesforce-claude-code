'use strict';

/**
 * hook-input.js — Normalize hook input across Claude Code and Cursor formats.
 *
 * Claude Code and Cursor send different JSON structures for the same logical data:
 *
 *   | Data          | Claude Code                    | Cursor                    |
 *   |---------------|--------------------------------|---------------------------|
 *   | Shell command | tool_input.command             | command                   |
 *   | File path     | tool_input.file_path           | file_path                 |
 *   | Shell output  | tool_output (stringified JSON) | output (raw text)         |
 *   | File edits    | N/A                            | edits[]                   |
 *   | Duration      | N/A                            | duration (ms)             |
 *   | Sandbox       | N/A                            | sandbox (boolean)         |
 *   | Prompt text   | prompt                         | prompt                    |
 *   | Tool name     | tool_name                      | tool_name                 |
 *   | Working dir   | cwd                            | cwd                       |
 *
 * This module provides a single normalizeInput() function that merges both
 * formats into a consistent shape. Scripts import this instead of parsing
 * raw input directly.
 */

/**
 * Normalize hook input from either Claude Code or Cursor format.
 *
 * @param {object} raw - The parsed JSON input from stdin
 * @returns {object} Normalized input with consistent field names
 */
function normalizeInput(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      filePath: '',
      command: '',
      toolName: '',
      cwd: '',
      output: '',
      edits: [],
      duration: 0,
      sandbox: false,
      prompt: '',
      raw: raw || {},
    };
  }

  return {
    // File path: Cursor sends top-level, Claude Code nests under tool_input
    filePath: raw.file_path || (raw.tool_input && raw.tool_input.file_path) || '',

    // Shell command: Cursor sends top-level, Claude Code nests under tool_input
    command: raw.command || (raw.tool_input && raw.tool_input.command) || '',

    // Tool name: same field in both harnesses
    toolName: raw.tool_name || '',

    // Working directory: same field in both harnesses
    cwd: raw.cwd || '',

    // Shell output: Cursor sends 'output' (string), Claude Code sends 'tool_output'
    // tool_output can be a string or object { output: '...' }
    output: raw.output
      || (typeof raw.tool_output === 'string' ? raw.tool_output : '')
      || (raw.tool_output && raw.tool_output.output) || '',

    // File edits: Cursor afterFileEdit sends edits[], Claude Code does not
    edits: raw.edits || [],

    // Duration: Cursor afterShellExecution sends duration (ms)
    duration: raw.duration || 0,

    // Sandbox: Cursor beforeShellExecution indicates sandboxed commands
    sandbox: raw.sandbox || false,

    // Prompt text: same field in both harnesses (UserPromptSubmit / beforeSubmitPrompt)
    prompt: raw.prompt || '',

    // Preserve the full raw input for any hook-specific fields
    raw,
  };
}

/**
 * Read and parse JSON from stdin, then normalize.
 * Convenience wrapper used by most hook scripts.
 *
 * @returns {Promise<object>} Normalized input
 */
function readInput() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        resolve(normalizeInput(parsed));
      } catch {
        resolve(normalizeInput({}));
      }
    });
  });
}

module.exports = { normalizeInput, readInput };
