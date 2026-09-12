const fs = require('node:fs');
const path = require('node:path');
const db = require('../electron/db.cjs');

const p = path.join(__dirname, '..', '.tmp-notes.db');
if (fs.existsSync(p)) fs.unlinkSync(p);
db.initDbFile(p);
console.log('cats', db.listNoteCategories().map((c) => c.name).join(','));
const n = db.createNote({
  title: '测试琐事',
  content: 'hello',
  category_id: db.listNoteCategories()[0].id,
});
console.log('note', n.id, n.title, n.category_name);
db.updateNote(n.id, { pinned: true });
console.log('list', db.listNotes({}).length, JSON.stringify(db.getNoteStats()));
db.closeDb();
fs.unlinkSync(p);
console.log('OK');
