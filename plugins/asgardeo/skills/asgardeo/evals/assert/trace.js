/**
 * Output transform: append a trace of what the agent did (asg commands run,
 * files written) to its reply, so llm-rubric graders can judge tool-level
 * behaviour they otherwise never see. Deterministic checks in asg-checks.js
 * read context.metadata directly and ignore this section; noSecretLeak looks
 * only at the reply above the marker.
 */
'use strict';

const MARKER = '\n\n--- eval trace (appended by assert/trace.js; not part of the reply) ---\n';
const MAX_FILE = 4000;

module.exports = (output, context) => {
  const calls = (context && context.metadata && context.metadata.toolCalls) || [];
  const lines = [];
  for (const c of calls) {
    if (c.name === 'Bash') {
      const cmd = String(c.input && c.input.command || '').trim();
      const first = String(c.output || '').trim().split('\n')[0] || '';
      lines.push(`$ ${cmd.replace(/\s*\\\n\s*/g, ' ').slice(0, 400)}\n  → ${first.slice(0, 200)}`);
    } else if (c.name === 'Write' || c.name === 'Edit') {
      const file = String(c.input && c.input.file_path || '').replace(/.*fixtures\/workspace\//, '');
      const body = c.name === 'Write' ? String(c.input.content || '') : `--- old ---\n${c.input.old_string || ''}\n--- new ---\n${c.input.new_string || ''}`;
      lines.push(`# ${c.name} ${file}\n${body.length > MAX_FILE ? body.slice(0, MAX_FILE) + '\n…[truncated]' : body}`);
    } else if (c.name === 'WebFetch') {
      lines.push(`# WebFetch ${String(c.input && c.input.url || '')}`);
    } else if (c.name === 'Read' || c.name === 'Glob' || c.name === 'Grep') {
      lines.push(`# ${c.name} ${String(c.input && (c.input.file_path || c.input.pattern) || '').replace(/.*fixtures\/workspace\//, '')}`);
    }
  }
  if (!lines.length) return output;
  return `${output}${MARKER}${lines.join('\n\n')}`;
};
module.exports.MARKER = MARKER;
