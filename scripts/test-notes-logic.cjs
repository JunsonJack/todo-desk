const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const db = require('../electron/db.cjs');

const p = path.join(__dirname, '..', '.tmp-notes-logic.db');
if (fs.existsSync(p)) fs.unlinkSync(p);
db.initDbFile(p);

const cats = db.listNoteCategories();
assert.ok(cats.length >= 5, 'should seed default categories');

const life = cats.find((c) => c.name === '生活');
const n1 = db.createNote({ title: '路由器', content: '192.168.1.1', category_id: life.id, tags: '网络' });
const n2 = db.createNote({ title: '无分类', content: 'hello world' });
const n3 = db.createNote({ title: '置顶项', content: 'pin me', pinned: true, category_id: life.id });

const active = db.listNotes({ archived: false });
assert.strictEqual(active.length, 3, 'active count');

const lifeList = db.listNotes({ archived: false, category: life.id });
assert.strictEqual(lifeList.length, 2, 'life category count');

const noneList = db.listNotes({ archived: false, category: 'none' });
assert.strictEqual(noneList.length, 1, 'none category count');

assert.strictEqual(active[0].title, '置顶项', 'pinned first');

db.updateNote(n1.id, { archived: true });
assert.strictEqual(db.listNotes({ archived: false }).length, 2, 'after archive active');
assert.strictEqual(db.listNotes({ archived: true }).length, 1, 'after archive archived');
assert.strictEqual(db.getNoteStats().archived, 1);

db.updateNote(n1.id, { archived: false });
assert.strictEqual(db.listNotes({ archived: false }).length, 3);

db.deleteNote(n2.id);
assert.strictEqual(db.listNotes({ archived: false }).length, 2);

assert.throws(() => db.createNote({ title: '  ' }), /标题/);
assert.throws(() => db.createNoteCategory({ name: '生活' }), /已存在/);

const n4 = db.createNote({ title: '临时分类', category_id: life.id });
db.deleteNoteCategory(life.id);
assert.strictEqual(db.getNote(n4.id).category_id, null, 'category delete nulls notes');

db.updateNote(n3.id, { pinned: false });
assert.strictEqual(db.getNote(n3.id).pinned, false);
assert.strictEqual(db.getNote(n3.id).title, '置顶项', 'other fields preserved');

db.closeDb();
fs.unlinkSync(p);
console.log('ALL NOTES LOGIC TESTS PASSED');
