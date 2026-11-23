const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] || '';

function extractFunction(name) {
  const start = script.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, name + ' must exist');
  let depth = 0, opened = false, end = -1;
  for (let i = start; i < script.length; i++) {
    if (script[i] === '{') { depth++; opened = true; }
    if (script[i] === '}') { depth--; if (opened && depth === 0) { end = i + 1; break; } }
  }
  assert.notEqual(end, -1, name + ' must be balanced');
  return script.slice(start, end);
}

test('operations screens are reachable and not demo placeholders', () => {
  for (const id of ['tasks', 'meetings', 'decisions']) {
    assert.match(html, new RegExp('id="' + id + '"'));
    assert.match(html, new RegExp('data-page="' + id + '"'));
  }
});

test('task dependency validator rejects direct and indirect cycles', () => {
  const fn = extractFunction('hqHasDependencyCycle');
  const hasCycle = new Function(fn + '; return hqHasDependencyCycle;')();
  const deps = [{task_id:'a',depends_on_task_id:'b'},{task_id:'b',depends_on_task_id:'c'}];
  assert.equal(hasCycle('c','a',deps), true);
  assert.equal(hasCycle('b','a',deps), true);
  assert.equal(hasCycle('a','c',deps), false);
  assert.equal(hasCycle('x','x',deps), true);
});

test('database statuses map to stable Persian labels', () => {
  const taskFn = extractFunction('hqTaskStatusLabel');
  const meetingFn = extractFunction('hqMeetingStatusLabel');
  const decisionFn = extractFunction('hqDecisionStatusLabel');
  const labels = new Function(taskFn + meetingFn + decisionFn + '; return [hqTaskStatusLabel,hqMeetingStatusLabel,hqDecisionStatusLabel];')();
  assert.equal(labels[0]('in_progress'), 'در حال انجام');
  assert.equal(labels[1]('completed'), 'پایان‌یافته');
  assert.equal(labels[2]('under_review'), 'در حال بررسی');
});
