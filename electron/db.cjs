const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

let db;

function getDbPath(userDataPath) {
  const dir = path.join(userDataPath, 'data');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'todo.db');
}

function ensureSchema() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6C8EFF',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS priorities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#FF453A',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo'
        CHECK (status IN ('todo', 'doing', 'done')),
      priority TEXT NOT NULL DEFAULT 'medium',
      due_date TEXT,
      project_id INTEGER,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);

    CREATE TABLE IF NOT EXISTS note_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#0A84FF',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      category_id INTEGER,
      tags TEXT DEFAULT '',
      pinned INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (category_id) REFERENCES note_categories(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category_id);
    CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(pinned);
    CREATE INDEX IF NOT EXISTS idx_notes_archived ON notes(archived);
  `);

  migrateTasksPriorityCheck();
  seedNoteCategories();

  const projectCount = db.prepare('SELECT COUNT(*) AS c FROM projects').get().c;
  if (projectCount === 0) {
    db.prepare('INSERT INTO projects (name, color) VALUES (?, ?)').run('个人', '#6C8EFF');
    db.prepare('INSERT INTO projects (name, color) VALUES (?, ?)').run('工作', '#F0A45D');
    db.prepare('INSERT INTO projects (name, color) VALUES (?, ?)').run('学习', '#5BB89A');
  }

  const priorityCount = db.prepare('SELECT COUNT(*) AS c FROM priorities').get().c;
  if (priorityCount === 0) {
    const defaults = [
      ['urgent', '紧急', '#FF453A', 0],
      ['high', '高', '#FF9F0A', 1],
      ['medium', '中', '#0A84FF', 2],
      ['low', '低', '#8E8E93', 3],
    ];
    const insert = db.prepare(
      'INSERT INTO priorities (code, name, color, sort_order) VALUES (?, ?, ?, ?)',
    );
    for (const row of defaults) insert.run(...row);
  }

  return true;
}

function migrateTasksPriorityCheck() {
  const table = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'tasks'",
  ).get();
  if (!table?.sql || !table.sql.includes('CHECK (priority IN')) return;

  db.exec(`
    BEGIN;
    CREATE TABLE tasks_migrate (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo'
        CHECK (status IN ('todo', 'doing', 'done')),
      priority TEXT NOT NULL DEFAULT 'medium',
      due_date TEXT,
      project_id INTEGER,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );
    INSERT INTO tasks_migrate (
      id, title, description, status, priority, due_date, project_id, completed_at, created_at, updated_at
    )
    SELECT id, title, description, status, priority, due_date, project_id, completed_at, created_at, updated_at
    FROM tasks;
    DROP TABLE tasks;
    ALTER TABLE tasks_migrate RENAME TO tasks;
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    COMMIT;
  `);
}

function getDefaultPriorityCode() {
  const row = db.prepare(
    'SELECT code FROM priorities ORDER BY sort_order ASC, id ASC LIMIT 1',
  ).get();
  return row?.code || 'medium';
}

function ensurePriorityCode(code) {
  if (!code) return getDefaultPriorityCode();
  const row = db.prepare('SELECT code FROM priorities WHERE code = ?').get(code);
  if (row) return row.code;
  return getDefaultPriorityCode();
}


function openDatabase(dbFilePath) {
  const dir = path.dirname(dbFilePath);
  fs.mkdirSync(dir, { recursive: true });
  db = new DatabaseSync(dbFilePath);
  ensureSchema();
  return true;
}

function initDb(userDataPath) {
  return openDatabase(getDbPath(userDataPath));
}

function initDbFile(dbFilePath) {
  return openDatabase(dbFilePath);
}

function mapTask(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    status: row.status,
    priority: row.priority,
    priority_name: row.priority_name || row.priority,
    priority_color: row.priority_color || '#8E8E93',
    priority_sort: row.priority_sort ?? 99,
    due_date: row.due_date || null,
    project_id: row.project_id ?? null,
    completed_at: row.completed_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    project_name: row.project_name || null,
    project_color: row.project_color || null,
  };
}

const TASK_SELECT = `
  SELECT t.*, p.name AS project_name, p.color AS project_color,
    pr.name AS priority_name, pr.color AS priority_color, pr.sort_order AS priority_sort
  FROM tasks t
  LEFT JOIN projects p ON p.id = t.project_id
  LEFT JOIN priorities pr ON pr.code = t.priority
`;

function listTasks(filters = {}) {
  const where = [];
  const params = [];

  if (filters.status) {
    where.push('t.status = ?');
    params.push(filters.status);
  }
  if (filters.project_id != null) {
    where.push('t.project_id = ?');
    params.push(filters.project_id);
  }
  if (filters.due_from) {
    where.push('t.due_date >= ?');
    params.push(filters.due_from);
  }
  if (filters.due_to) {
    where.push('t.due_date <= ?');
    params.push(filters.due_to);
  }
  if (filters.due_date) {
    where.push('t.due_date = ?');
    params.push(filters.due_date);
  }
  if (filters.q) {
    where.push('(t.title LIKE ? OR t.description LIKE ?)');
    params.push(`%${filters.q}%`, `%${filters.q}%`);
  }

  const sql = `${TASK_SELECT}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY
      CASE t.status WHEN 'done' THEN 1 ELSE 0 END,
      COALESCE(pr.sort_order, 99),
      CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
      t.due_date ASC,
      t.id DESC
  `;

  return db.prepare(sql).all(...params).map(mapTask);
}

function getTask(id) {
  const row = db.prepare(`${TASK_SELECT} WHERE t.id = ?`).get(id);
  return row ? mapTask(row) : null;
}

function createTask(input) {
  const title = String(input.title || '').trim();
  if (!title) throw new Error('标题不能为空');

  const priority = ensurePriorityCode(input.priority);
  const result = db.prepare(`
    INSERT INTO tasks (title, description, status, priority, due_date, project_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    title,
    input.description || '',
    input.status || 'todo',
    priority,
    input.due_date || null,
    input.project_id ?? null,
  );
  return getTask(result.lastInsertRowid);
}

function updateTask(id, patch) {
  const existing = getTask(id);
  if (!existing) throw new Error('任务不存在');

  const title = patch.title != null ? String(patch.title).trim() : existing.title;
  if (!title) throw new Error('标题不能为空');

  const next = {
    title,
    description: patch.description != null ? patch.description : existing.description,
    status: patch.status != null ? patch.status : existing.status,
    priority: patch.priority != null ? ensurePriorityCode(patch.priority) : existing.priority,
    due_date: patch.due_date !== undefined ? patch.due_date : existing.due_date,
    project_id: patch.project_id !== undefined ? patch.project_id : existing.project_id,
  };

  let completedAt = existing.completed_at;
  if (next.status === 'done' && existing.status !== 'done') {
    completedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
  } else if (next.status !== 'done') {
    completedAt = null;
  }

  db.prepare(`
    UPDATE tasks SET
      title = ?, description = ?, status = ?, priority = ?,
      due_date = ?, project_id = ?, completed_at = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    next.title,
    next.description,
    next.status,
    next.priority,
    next.due_date,
    next.project_id,
    completedAt,
    id,
  );

  return getTask(id);
}

function deleteTask(id) {
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return { deleted: result.changes > 0, id };
}

function listProjects() {
  return db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status != 'done') AS open_count
    FROM projects p
    ORDER BY p.id ASC
  `).all();
}

function createProject({ name, color }) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('项目名称不能为空');
  const result = db.prepare('INSERT INTO projects (name, color) VALUES (?, ?)')
    .run(trimmed, color || '#6C8EFF');
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
}

function updateProject(id, { name, color }) {
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!existing) throw new Error('项目不存在');
  const nextName = name != null ? String(name).trim() : existing.name;
  if (!nextName) throw new Error('项目名称不能为空');
  db.prepare('UPDATE projects SET name = ?, color = ? WHERE id = ?')
    .run(nextName, color || existing.color, id);
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
}

function deleteProject(id) {
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  return { deleted: result.changes > 0, id };
}

function getStats() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  const total = db.prepare('SELECT COUNT(*) AS c FROM tasks').get().c;
  const done = db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE status = 'done'").get().c;
  const todayTotal = db.prepare('SELECT COUNT(*) AS c FROM tasks WHERE due_date = ?').get(todayStr).c;
  const todayDone = db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE due_date = ? AND status = 'done'").get(todayStr).c;
  const overdue = db.prepare(`
    SELECT COUNT(*) AS c FROM tasks
    WHERE due_date < ? AND status != 'done'
  `).get(todayStr).c;
  const top = getDefaultPriorityCode();
  const urgentOpen = db.prepare(`
    SELECT COUNT(*) AS c FROM tasks
    WHERE priority = ? AND status != 'done'
  `).get(top).c;

  return { total, done, todayTotal, todayDone, overdue, urgentOpen, today: todayStr, topPriority: top };
}

function listPriorities() {
  return db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM tasks t WHERE t.priority = p.code) AS task_count,
      (SELECT COUNT(*) FROM tasks t WHERE t.priority = p.code AND t.status != 'done') AS open_count
    FROM priorities p
    ORDER BY p.sort_order ASC, p.id ASC
  `).all();
}

function createPriority({ name, color, code }) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('紧急程度名称不能为空');

  const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS s FROM priorities').get().s;
  const safeCode = String(code || `p_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`)
    .trim()
    .toLowerCase();
  const exists = db.prepare('SELECT id FROM priorities WHERE code = ?').get(safeCode);
  if (exists) throw new Error(`紧急程度编码已存在：${safeCode}`);

  const result = db.prepare(
    'INSERT INTO priorities (code, name, color, sort_order) VALUES (?, ?, ?, ?)',
  ).run(safeCode, trimmed, color || '#0A84FF', maxSort + 1);
  return db.prepare('SELECT * FROM priorities WHERE id = ?').get(result.lastInsertRowid);
}

function updatePriority(id, patch = {}) {
  const existing = db.prepare('SELECT * FROM priorities WHERE id = ?').get(id);
  if (!existing) throw new Error('紧急程度不存在');

  const name = patch.name != null ? String(patch.name).trim() : existing.name;
  if (!name) throw new Error('紧急程度名称不能为空');
  const color = patch.color || existing.color;
  const sortOrder = patch.sort_order != null ? Number(patch.sort_order) : existing.sort_order;

  db.prepare('UPDATE priorities SET name = ?, color = ?, sort_order = ? WHERE id = ?')
    .run(name, color, sortOrder, id);
  return db.prepare('SELECT * FROM priorities WHERE id = ?').get(id);
}

function deletePriority(id) {
  const existing = db.prepare('SELECT * FROM priorities WHERE id = ?').get(id);
  if (!existing) return { deleted: false, id };

  const remaining = listPriorities().filter((p) => p.id !== id);
  if (remaining.length === 0) {
    throw new Error('至少保留一个紧急程度');
  }

  const fallback = remaining[0].code;
  db.prepare('UPDATE tasks SET priority = ? WHERE priority = ?').run(fallback, existing.code);
  db.prepare('DELETE FROM priorities WHERE id = ?').run(id);
  normalizePriorityOrder();
  return { deleted: true, id, fallback_priority: fallback };
}

function movePriority(id, direction) {
  normalizePriorityOrder();
  const list = listPriorities();
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) throw new Error('紧急程度不存在');
  const target = direction === 'up' ? idx - 1 : idx + 1;
  if (target < 0 || target >= list.length) {
    return listPriorities();
  }
  const a = list[idx];
  const b = list[target];
  db.prepare('UPDATE priorities SET sort_order = ? WHERE id = ?').run(target, a.id);
  db.prepare('UPDATE priorities SET sort_order = ? WHERE id = ?').run(idx, b.id);
  return listPriorities();
}

function reorderPriorities(orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new Error('排序列表不能为空');
  }
  const current = listPriorities();
  const currentIds = current.map((p) => p.id);
  const incoming = orderedIds.map((id) => Number(id));
  if (incoming.length !== currentIds.length) {
    throw new Error('排序项数量与现有紧急程度不一致');
  }
  const unique = new Set(incoming);
  if (unique.size !== incoming.length || currentIds.some((id) => !unique.has(id))) {
    throw new Error('排序项与现有紧急程度不匹配');
  }

  db.exec('BEGIN');
  try {
    incoming.forEach((id, index) => {
      db.prepare('UPDATE priorities SET sort_order = ? WHERE id = ?').run(index, id);
    });
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return listPriorities();
}

function normalizePriorityOrder() {
  listPriorities().forEach((p, i) => {
    db.prepare('UPDATE priorities SET sort_order = ? WHERE id = ?').run(i, p.id);
  });
}

function seedNoteCategories() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM note_categories').get().c;
  if (count > 0) return;
  const defaults = [
    ['生活', '#30D158'],
    ['工作备忘', '#0A84FF'],
    ['密码提示', '#FF9F0A'],
    ['灵感', '#BF5AF2'],
    ['购物', '#FF453A'],
  ];
  const insert = db.prepare(
    'INSERT INTO note_categories (name, color, sort_order) VALUES (?, ?, ?)',
  );
  defaults.forEach((row, i) => insert.run(row[0], row[1], i));
}

function mapNote(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content || '',
    category_id: row.category_id ?? null,
    tags: row.tags || '',
    pinned: !!row.pinned,
    archived: !!row.archived,
    created_at: row.created_at,
    updated_at: row.updated_at,
    category_name: row.category_name || null,
    category_color: row.category_color || null,
  };
}

const NOTE_SELECT = `
  SELECT n.*, c.name AS category_name, c.color AS category_color
  FROM notes n
  LEFT JOIN note_categories c ON c.id = n.category_id
`;

function listNoteCategories() {
  return db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM notes n WHERE n.category_id = c.id AND n.archived = 0) AS note_count,
      (SELECT COUNT(*) FROM notes n WHERE n.category_id = c.id AND n.pinned = 1 AND n.archived = 0) AS pinned_count
    FROM note_categories c
    ORDER BY c.sort_order ASC, c.id ASC
  `).all();
}

function createNoteCategory({ name, color }) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('分类名称不能为空');
  const exists = db.prepare('SELECT id FROM note_categories WHERE name = ?').get(trimmed);
  if (exists) throw new Error(`分类已存在：${trimmed}`);
  const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS s FROM note_categories').get().s;
  const result = db.prepare(
    'INSERT INTO note_categories (name, color, sort_order) VALUES (?, ?, ?)',
  ).run(trimmed, color || '#0A84FF', maxSort + 1);
  return db.prepare('SELECT * FROM note_categories WHERE id = ?').get(result.lastInsertRowid);
}

function updateNoteCategory(id, patch = {}) {
  const existing = db.prepare('SELECT * FROM note_categories WHERE id = ?').get(id);
  if (!existing) throw new Error('分类不存在');
  const name = patch.name != null ? String(patch.name).trim() : existing.name;
  if (!name) throw new Error('分类名称不能为空');
  const color = patch.color || existing.color;
  db.prepare('UPDATE note_categories SET name = ?, color = ? WHERE id = ?')
    .run(name, color, id);
  return db.prepare('SELECT * FROM note_categories WHERE id = ?').get(id);
}

function deleteNoteCategory(id) {
  const existing = db.prepare('SELECT * FROM note_categories WHERE id = ?').get(id);
  if (!existing) return { deleted: false, id };
  db.prepare('UPDATE notes SET category_id = NULL WHERE category_id = ?').run(id);
  db.prepare('DELETE FROM note_categories WHERE id = ?').run(id);
  listNoteCategories().forEach((c, i) => {
    db.prepare('UPDATE note_categories SET sort_order = ? WHERE id = ?').run(i, c.id);
  });
  return { deleted: true, id };
}

function listNotes(filters = {}) {
  const where = [];
  const params = [];

  if (filters.archived === true || filters.archived === 1) {
    where.push('n.archived = 1');
  } else if (filters.archived === false || filters.archived === 0 || filters.archived == null) {
    where.push('n.archived = 0');
  }

  if (filters.category === 'none') {
    where.push('n.category_id IS NULL');
  } else if (filters.category === 'pinned') {
    where.push('n.pinned = 1');
  } else if (filters.category != null && filters.category !== 'all') {
    where.push('n.category_id = ?');
    params.push(Number(filters.category));
  }

  if (filters.q) {
    where.push('(n.title LIKE ? OR n.content LIKE ? OR n.tags LIKE ?)');
    const q = `%${filters.q}%`;
    params.push(q, q, q);
  }

  const sql = `${NOTE_SELECT}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY n.pinned DESC, n.updated_at DESC, n.id DESC
  `;
  return db.prepare(sql).all(...params).map(mapNote);
}

function getNote(id) {
  const row = db.prepare(`${NOTE_SELECT} WHERE n.id = ?`).get(id);
  return row ? mapNote(row) : null;
}

function createNote(input) {
  const title = String(input.title || '').trim();
  if (!title) throw new Error('标题不能为空');
  const result = db.prepare(`
    INSERT INTO notes (title, content, category_id, tags, pinned, archived)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    title,
    input.content || '',
    input.category_id != null ? Number(input.category_id) : null,
    input.tags || '',
    input.pinned ? 1 : 0,
    input.archived ? 1 : 0,
  );
  return getNote(result.lastInsertRowid);
}

function updateNote(id, patch = {}) {
  const existing = getNote(id);
  if (!existing) throw new Error('琐事不存在');
  const title = patch.title != null ? String(patch.title).trim() : existing.title;
  if (!title) throw new Error('标题不能为空');
  db.prepare(`
    UPDATE notes SET
      title = ?, content = ?, category_id = ?, tags = ?, pinned = ?, archived = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    title,
    patch.content != null ? patch.content : existing.content,
    patch.category_id !== undefined
      ? (patch.category_id == null ? null : Number(patch.category_id))
      : existing.category_id,
    patch.tags != null ? patch.tags : existing.tags,
    patch.pinned != null ? (patch.pinned ? 1 : 0) : (existing.pinned ? 1 : 0),
    patch.archived != null ? (patch.archived ? 1 : 0) : (existing.archived ? 1 : 0),
    id,
  );
  return getNote(id);
}

function deleteNote(id) {
  const result = db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  return { deleted: result.changes > 0, id };
}

function getNoteStats() {
  const total = db.prepare('SELECT COUNT(*) AS c FROM notes WHERE archived = 0').get().c;
  const pinned = db.prepare('SELECT COUNT(*) AS c FROM notes WHERE archived = 0 AND pinned = 1').get().c;
  const archived = db.prepare('SELECT COUNT(*) AS c FROM notes WHERE archived = 1').get().c;
  return { total, pinned, archived };
}

function closeDb() {
  try {
    db?.close();
  } catch (_) {
    // ignore
  }
}

function exportAllData() {
  const now = new Date().toISOString();
  return {
    app: 'todo-desk',
    schema_version: 1,
    exported_at: now,
    data: {
      projects: db.prepare('SELECT id, name, color, created_at FROM projects ORDER BY id').all(),
      priorities: db.prepare('SELECT id, code, name, color, sort_order, created_at FROM priorities ORDER BY sort_order, id').all(),
      tasks: db.prepare(`
        SELECT id, title, description, status, priority, due_date, project_id,
               completed_at, created_at, updated_at
        FROM tasks ORDER BY id
      `).all(),
      note_categories: db.prepare('SELECT id, name, color, sort_order, created_at FROM note_categories ORDER BY sort_order, id').all(),
      notes: db.prepare(`
        SELECT id, title, content, category_id, tags, pinned, archived, created_at, updated_at
        FROM notes ORDER BY id
      `).all(),
    },
    counts: {
      projects: db.prepare('SELECT COUNT(*) AS c FROM projects').get().c,
      priorities: db.prepare('SELECT COUNT(*) AS c FROM priorities').get().c,
      tasks: db.prepare('SELECT COUNT(*) AS c FROM tasks').get().c,
      note_categories: db.prepare('SELECT COUNT(*) AS c FROM note_categories').get().c,
      notes: db.prepare('SELECT COUNT(*) AS c FROM notes').get().c,
    },
  };
}

function importAllData(payload, mode = 'replace') {
  const data = payload?.data || payload;
  if (!data || typeof data !== 'object') {
    throw new Error('导入文件格式不正确');
  }

  const projects = Array.isArray(data.projects) ? data.projects : [];
  const priorities = Array.isArray(data.priorities) ? data.priorities : [];
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  const noteCategories = Array.isArray(data.note_categories) ? data.note_categories : [];
  const notes = Array.isArray(data.notes) ? data.notes : [];
  const isMerge = mode === 'merge';

  const before = {
    projects: db.prepare('SELECT COUNT(*) AS c FROM projects').get().c,
    priorities: db.prepare('SELECT COUNT(*) AS c FROM priorities').get().c,
    tasks: db.prepare('SELECT COUNT(*) AS c FROM tasks').get().c,
    note_categories: db.prepare('SELECT COUNT(*) AS c FROM note_categories').get().c,
    notes: db.prepare('SELECT COUNT(*) AS c FROM notes').get().c,
  };

  db.exec('BEGIN');
  try {
    if (!isMerge) {
      db.exec('DELETE FROM notes');
      db.exec('DELETE FROM note_categories');
      db.exec('DELETE FROM tasks');
      db.exec('DELETE FROM priorities');
      db.exec('DELETE FROM projects');
    }

    const insertProject = db.prepare(
      'INSERT INTO projects (id, name, color, created_at) VALUES (?, ?, ?, ?)',
    );
    projects.forEach((p) => {
      const name = String(p.name || '未命名').trim() || '未命名';
      if (isMerge) {
        if (p.id != null && db.prepare('SELECT id FROM projects WHERE id = ?').get(p.id)) return;
        if (db.prepare('SELECT id FROM projects WHERE name = ?').get(name)) return;
      }
      const created = p.created_at || new Date().toISOString().replace('T', ' ').slice(0, 19);
      if (p.id != null) {
        insertProject.run(p.id, name, p.color || '#6C8EFF', created);
      } else {
        db.prepare('INSERT INTO projects (name, color, created_at) VALUES (?, ?, ?)')
          .run(name, p.color || '#6C8EFF', created);
      }
    });

    const insertPriority = db.prepare(
      'INSERT INTO priorities (id, code, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    );
    priorities.forEach((p, i) => {
      const code = String(p.code || `p_${p.id || i}`).toLowerCase();
      if (isMerge) {
        if (p.id != null && db.prepare('SELECT id FROM priorities WHERE id = ?').get(p.id)) return;
        if (db.prepare('SELECT id FROM priorities WHERE code = ?').get(code)) return;
      }
      const name = String(p.name || '紧急').trim() || '紧急';
      const created = p.created_at || new Date().toISOString().replace('T', ' ').slice(0, 19);
      if (p.id != null) {
        insertPriority.run(p.id, code, name, p.color || '#FF453A', p.sort_order != null ? p.sort_order : i, created);
      } else {
        db.prepare('INSERT INTO priorities (code, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(code, name, p.color || '#FF453A', p.sort_order != null ? p.sort_order : i, created);
      }
    });
    if (!isMerge && priorities.length === 0) {
      db.prepare('INSERT INTO priorities (code, name, color, sort_order) VALUES (?, ?, ?, ?)')
        .run('medium', '中', '#0A84FF', 0);
    }

    const priorityCodes = new Set(db.prepare('SELECT code FROM priorities').all().map((r) => r.code));
    const fallbackPriority = db.prepare('SELECT code FROM priorities ORDER BY sort_order, id LIMIT 1').get()?.code || 'medium';

    const insertTask = db.prepare(`
      INSERT INTO tasks (id, title, description, status, priority, due_date, project_id, completed_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    tasks.forEach((t) => {
      if (isMerge && t.id != null && db.prepare('SELECT id FROM tasks WHERE id = ?').get(t.id)) return;
      let projectId = t.project_id ?? null;
      if (projectId != null && !db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)) {
        projectId = null;
      }
      let priority = t.priority || fallbackPriority;
      if (!priorityCodes.has(priority)) priority = fallbackPriority;
      const title = String(t.title || '').trim() || '未命名任务';
      const created = t.created_at || new Date().toISOString().replace('T', ' ').slice(0, 19);
      const updated = t.updated_at || created;
      if (t.id != null) {
        insertTask.run(t.id, title, t.description || '', t.status || 'todo', priority, t.due_date || null, projectId, t.completed_at || null, created, updated);
      } else {
        db.prepare('INSERT INTO tasks (title, description, status, priority, due_date, project_id, completed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(title, t.description || '', t.status || 'todo', priority, t.due_date || null, projectId, t.completed_at || null, created, updated);
      }
    });

    const insertCat = db.prepare(
      'INSERT INTO note_categories (id, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?)',
    );
    noteCategories.forEach((c, i) => {
      const name = String(c.name || '未命名').trim() || '未命名';
      if (isMerge) {
        if (c.id != null && db.prepare('SELECT id FROM note_categories WHERE id = ?').get(c.id)) return;
        if (db.prepare('SELECT id FROM note_categories WHERE name = ?').get(name)) return;
      }
      const created = c.created_at || new Date().toISOString().replace('T', ' ').slice(0, 19);
      if (c.id != null) {
        insertCat.run(c.id, name, c.color || '#0A84FF', c.sort_order != null ? c.sort_order : i, created);
      } else {
        db.prepare('INSERT INTO note_categories (name, color, sort_order, created_at) VALUES (?, ?, ?, ?)')
          .run(name, c.color || '#0A84FF', c.sort_order != null ? c.sort_order : i, created);
      }
    });
    if (!isMerge && noteCategories.length === 0) {
      db.prepare('INSERT INTO note_categories (name, color, sort_order) VALUES (?, ?, ?)')
        .run('生活', '#30D158', 0);
    }

    const insertNote = db.prepare(`
      INSERT INTO notes (id, title, content, category_id, tags, pinned, archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    notes.forEach((n) => {
      if (isMerge && n.id != null && db.prepare('SELECT id FROM notes WHERE id = ?').get(n.id)) return;
      let categoryId = n.category_id ?? null;
      if (categoryId != null && !db.prepare('SELECT id FROM note_categories WHERE id = ?').get(categoryId)) {
        categoryId = null;
      }
      const title = String(n.title || '').trim() || '未命名琐事';
      const created = n.created_at || new Date().toISOString().replace('T', ' ').slice(0, 19);
      const updated = n.updated_at || created;
      if (n.id != null) {
        insertNote.run(n.id, title, n.content || '', categoryId, n.tags || '', n.pinned ? 1 : 0, n.archived ? 1 : 0, created, updated);
      } else {
        db.prepare('INSERT INTO notes (title, content, category_id, tags, pinned, archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(title, n.content || '', categoryId, n.tags || '', n.pinned ? 1 : 0, n.archived ? 1 : 0, created, updated);
      }
    });

    for (const table of ['projects', 'priorities', 'tasks', 'note_categories', 'notes']) {
      const max = db.prepare(`SELECT COALESCE(MAX(id), 0) AS m FROM ${table}`).get().m;
      db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(table);
      if (max > 0) {
        db.prepare('INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)').run(table, max);
      }
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const after = {
    projects: db.prepare('SELECT COUNT(*) AS c FROM projects').get().c,
    priorities: db.prepare('SELECT COUNT(*) AS c FROM priorities').get().c,
    tasks: db.prepare('SELECT COUNT(*) AS c FROM tasks').get().c,
    note_categories: db.prepare('SELECT COUNT(*) AS c FROM note_categories').get().c,
    notes: db.prepare('SELECT COUNT(*) AS c FROM notes').get().c,
  };

  if (isMerge) {
    return {
      mode: 'merge',
      added: {
        projects: after.projects - before.projects,
        priorities: after.priorities - before.priorities,
        tasks: after.tasks - before.tasks,
        note_categories: after.note_categories - before.note_categories,
        notes: after.notes - before.notes,
      },
      totals: after,
    };
  }

  return { mode: 'replace', totals: after, counts: after };
}

module.exports = {
  initDb,
  initDbFile,
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  listPriorities,
  createPriority,
  updatePriority,
  deletePriority,
  movePriority,
  reorderPriorities,
  listNoteCategories,
  createNoteCategory,
  updateNoteCategory,
  deleteNoteCategory,
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  getNoteStats,
  getStats,
  exportAllData,
  importAllData,
  closeDb,
};
