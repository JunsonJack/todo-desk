const fs = require('node:fs');
const path = require('node:path');
const db = require('../electron/db.cjs');

const p = path.join(__dirname, '..', '.tmp-io.db');
if (fs.existsSync(p)) fs.unlinkSync(p);
db.initDbFile(p);
db.createTask({ title: '导出测试', priority: 'high' });
db.createNote({ title: '琐事导出', content: 'abc' });
const exp = db.exportAllData();
console.log('export counts', exp.counts);
const out = db.importAllData(exp);
console.log('import counts', out);
console.log('tasks', db.listTasks({}).map((t) => t.title));
console.log('notes', db.listNotes({}).map((n) => n.title));
db.closeDb();
fs.unlinkSync(p);
console.log('IO_OK');
