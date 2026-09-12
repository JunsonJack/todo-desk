const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const db = require('../electron/db.cjs');

const p = path.join(__dirname, '..', '.tmp-import-mode.db');
if (fs.existsSync(p)) fs.unlinkSync(p);
db.initDbFile(p);

db.createTask({ title: '本地已有', priority: 'high' });
db.createNote({ title: '本地琐事', content: 'local' });
const backup = db.exportAllData();
// mutate backup: add a new task without id collision by using high id
backup.data.tasks.push({
  id: 999,
  title: '备份新任务',
  description: '',
  status: 'todo',
  priority: 'high',
  due_date: null,
  project_id: null,
  completed_at: null,
  created_at: '2026-01-01 00:00:00',
  updated_at: '2026-01-01 00:00:00',
});
backup.data.notes.push({
  id: 999,
  title: '备份新琐事',
  content: 'from backup',
  category_id: null,
  tags: '',
  pinned: 0,
  archived: 0,
  created_at: '2026-01-01 00:00:00',
  updated_at: '2026-01-01 00:00:00',
});

// merge should add new, keep existing
const merge = db.importAllData(backup, 'merge');
assert.strictEqual(merge.mode, 'merge');
assert.ok(merge.added.tasks >= 1, 'merge adds tasks');
assert.ok(merge.totals.tasks >= 2, 'merge keeps local tasks');
assert.ok(db.listTasks({}).some((t) => t.title === '本地已有'));
assert.ok(db.listTasks({}).some((t) => t.title === '备份新任务'));
assert.ok(db.listNotes({}).some((n) => n.title === '本地琐事'));
assert.ok(db.listNotes({}).some((n) => n.title === '备份新琐事'));

// replace should match backup only
const replace = db.importAllData(backup, 'replace');
assert.strictEqual(replace.mode, 'replace');
const titles = db.listTasks({}).map((t) => t.title);
assert.ok(titles.includes('备份新任务'));
assert.ok(!titles.includes('本地已有') || backup.data.tasks.some((t) => t.title === '本地已有'));

db.closeDb();
fs.unlinkSync(p);
console.log('IMPORT MODE TESTS PASSED');
