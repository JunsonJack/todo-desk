#!/usr/bin/env node
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const os = require('node:os');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const db = require('../electron/db.cjs');

function defaultDbPath() {
  if (process.env.TODO_DB_PATH) {
    return process.env.TODO_DB_PATH;
  }
  return path.join(
    os.homedir(),
    'AppData',
    'Roaming',
    'todo-desktop',
    'data',
    'todo.db',
  );
}

const dbPath = process.env.TODO_DB_PATH || defaultDbPath();
db.initDbFile(dbPath);

const STATUS = z.enum(['todo', 'doing', 'done']);
const PRIORITY = z.string().min(1).describe('紧急程度 code，例如 urgent/high 或自定义');

function ok(data) {
  return {
    content: [
      {
        type: 'text',
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

function fail(message) {
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: String(message),
      },
    ],
  };
}

function wrap(handler) {
  return async (args) => {
    try {
      return await handler(args || {});
    } catch (err) {
      return fail(err?.message || err);
    }
  };
}

const server = new McpServer({
  name: 'todo-desktop',
  version: '1.0.0',
});

server.tool(
  'todo_list_tasks',
  '列出待办任务。支持按状态、紧急程度、项目、日期范围、关键词过滤。',
  {
    status: STATUS.optional().describe('任务状态：todo/doing/done'),
    priority: PRIORITY.optional().describe('紧急程度 code，可用 todo_list_priorities 查询'),
    project_id: z.number().int().optional().describe('项目 ID'),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
      .describe('精确截止日期，格式 YYYY-MM-DD'),
    due_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
      .describe('截止日期起始（含），格式 YYYY-MM-DD'),
    due_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
      .describe('截止日期结束（含），格式 YYYY-MM-DD'),
    q: z.string().optional().describe('标题/备注关键词'),
    limit: z.number().int().min(1).max(200).optional().describe('最多返回条数，默认 50'),
  },
  wrap(async (args) => {
    const list = db.listTasks(args || {});
    const limit = args.limit ?? 50;
    return ok({
      total: list.length,
      returned: Math.min(list.length, limit),
      tasks: list.slice(0, limit),
    });
  }),
);

server.tool(
  'todo_get_task',
  '按 ID 获取单条任务详情。',
  {
    id: z.number().int().describe('任务 ID'),
  },
  wrap(async ({ id }) => {
    const task = db.getTask(id);
    if (!task) throw new Error(`任务 ${id} 不存在`);
    return ok(task);
  }),
);

server.tool(
  'todo_create_task',
  '创建待办任务。',
  {
    title: z.string().min(1).describe('任务标题'),
    description: z.string().optional().describe('备注/详细说明'),
    status: STATUS.optional().describe('状态，默认 todo'),
    priority: PRIORITY.optional().describe('紧急程度，默认 medium'),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
      .describe('截止日期 YYYY-MM-DD'),
    project_id: z.number().int().optional().describe('所属项目 ID'),
  },
  wrap(async (args) => ok(db.createTask(args))),
);

server.tool(
  'todo_update_task',
  '更新任务的标题、备注、状态、紧急程度、截止日期或所属项目。',
  {
    id: z.number().int().describe('任务 ID'),
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    status: STATUS.optional(),
    priority: PRIORITY.optional(),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
      .describe('传 null 可清除截止日期'),
    project_id: z.number().int().nullable().optional()
      .describe('传 null 可取消项目归属'),
  },
  wrap(async ({ id, ...patch }) => ok(db.updateTask(id, patch))),
);

server.tool(
  'todo_complete_task',
  '将任务标记为已完成（status=done）。',
  {
    id: z.number().int().describe('任务 ID'),
  },
  wrap(async ({ id }) => ok(db.updateTask(id, { status: 'done' }))),
);

server.tool(
  'todo_reopen_task',
  '将已完成任务重新打开（status=todo）。',
  {
    id: z.number().int().describe('任务 ID'),
  },
  wrap(async ({ id }) => ok(db.updateTask(id, { status: 'todo' }))),
);

server.tool(
  'todo_delete_task',
  '删除任务。',
  {
    id: z.number().int().describe('任务 ID'),
  },
  wrap(async ({ id }) => ok(db.deleteTask(id))),
);

server.tool(
  'todo_list_projects',
  '列出所有项目及任务统计。',
  {},
  wrap(async () => ok(db.listProjects())),
);

server.tool(
  'todo_create_project',
  '创建项目（用于任务分组）。',
  {
    name: z.string().min(1).describe('项目名称'),
    color: z.string().optional().describe('颜色，例如 #6C8EFF'),
  },
  wrap(async (args) => ok(db.createProject(args))),
);

server.tool(
  'todo_update_project',
  '更新项目名称或颜色。',
  {
    id: z.number().int().describe('项目 ID'),
    name: z.string().min(1).optional(),
    color: z.string().optional(),
  },
  wrap(async ({ id, ...patch }) => ok(db.updateProject(id, patch))),
);

server.tool(
  'todo_delete_project',
  '删除项目。项目下任务会变成未分组。',
  {
    id: z.number().int().describe('项目 ID'),
  },
  wrap(async ({ id }) => ok(db.deleteProject(id))),
);

server.tool(
  'todo_list_priorities',
  '列出全部紧急程度（含排序与任务统计）。最上方为最高紧急度。',
  {},
  wrap(async () => ok(db.listPriorities())),
);

server.tool(
  'todo_create_priority',
  '新建紧急程度。',
  {
    name: z.string().min(1).describe('名称'),
    color: z.string().optional().describe('颜色，例如 #FF453A'),
    code: z.string().optional().describe('可选稳定编码'),
  },
  wrap(async (args) => ok(db.createPriority(args))),
);

server.tool(
  'todo_update_priority',
  '更新紧急程度名称或颜色。',
  {
    id: z.number().int().describe('紧急程度 ID'),
    name: z.string().min(1).optional(),
    color: z.string().optional(),
    sort_order: z.number().int().optional(),
  },
  wrap(async ({ id, ...patch }) => ok(db.updatePriority(id, patch))),
);

server.tool(
  'todo_delete_priority',
  '删除紧急程度。相关任务会回落到剩余第一项。',
  {
    id: z.number().int().describe('紧急程度 ID'),
  },
  wrap(async ({ id }) => ok(db.deletePriority(id))),
);

server.tool(
  'todo_get_stats',
  '获取总览统计：总数、已完成、今日任务、逾期、最高紧急等。',
  {},
  wrap(async () => ok(db.getStats())),
);

server.tool(
  'todo_list_today',
  '获取今天需要关注的任务：今日安排 + 逾期未完成 + 最高紧急任务。',
  {},
  wrap(async () => {
    const stats = db.getStats();
    const today = stats.today;
    const all = db.listTasks({});
    const todayTasks = all.filter((t) => t.due_date === today);
    const overdue = all.filter((t) => t.due_date && t.due_date < today && t.status !== 'done');
    const urgentOpen = all.filter((t) => t.priority === stats.topPriority && t.status !== 'done');
    const open = all.filter((t) => t.status !== 'done');

    return ok({
      today,
      stats,
      today_tasks: todayTasks,
      overdue_tasks: overdue,
      urgent_open_tasks: urgentOpen,
      open_tasks_preview: open.slice(0, 20),
    });
  }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout is reserved for MCP protocol; log to stderr only
  console.error(`[todo-mcp] ready. db=${dbPath}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[todo-mcp] failed:', err);
    process.exit(1);
  });
}

module.exports = { dbPath, server };
