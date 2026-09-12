const fs = require('node:fs');
const path = require('node:path');
const db = require('../electron/db.cjs');

const p = path.join(__dirname, '..', '.tmp-prio.db');
if (fs.existsSync(p)) fs.unlinkSync(p);
db.initDbFile(p);

console.log('priorities', db.listPriorities().map((x) => `${x.code}:${x.name}`).join(', '));
const c = db.createPriority({ name: '阻塞', color: '#BF5AF2' });
console.log('created', c.code, c.name);
const t = db.createTask({ title: '测试', priority: c.code });
console.log('task', t.priority, t.priority_name, t.priority_color);
const list = db.movePriority(c.id, 'up');
console.log('order', list.map((x) => x.code).join(' > '));
db.deletePriority(c.id);
console.log('after delete', db.listTasks({}).map((x) => x.priority).join(','));
db.closeDb();
fs.unlinkSync(p);
console.log('OK');
