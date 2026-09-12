import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverPath = path.join(root, 'mcp', 'server.cjs');

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath],
  cwd: root,
  env: { ...process.env },
  stderr: 'inherit',
});

const client = new Client({ name: 'todo-mcp-test', version: '1.0.0' });
await client.connect(transport);

const tools = await client.listTools();
console.log('TOOLS', tools.tools.map((t) => t.name).join(', '));

const today = new Date().toISOString().slice(0, 10);
const created = await client.callTool({
  name: 'todo_create_task',
  arguments: {
    title: 'MCP 接入验证任务',
    description: '由 MCP 测试脚本创建',
    priority: 'high',
    due_date: today,
  },
});
const createdTask = JSON.parse(created.content[0].text);
console.log('CREATED', createdTask.id, createdTask.title);

const completed = await client.callTool({
  name: 'todo_complete_task',
  arguments: { id: createdTask.id },
});
console.log('COMPLETED_STATUS', JSON.parse(completed.content[0].text).status);

const todayView = await client.callTool({
  name: 'todo_list_today',
  arguments: {},
});
const todayData = JSON.parse(todayView.content[0].text);
console.log('TODAY', todayData.today, 'todayTasks', todayData.today_tasks.length);

const projects = await client.callTool({
  name: 'todo_list_projects',
  arguments: {},
});
console.log('PROJECTS', JSON.parse(projects.content[0].text).length);

const stats = await client.callTool({
  name: 'todo_get_stats',
  arguments: {},
});
console.log('STATS', stats.content[0].text.replace(/\s+/g, ' '));

await client.callTool({
  name: 'todo_delete_task',
  arguments: { id: createdTask.id },
});
console.log('CLEANUP_OK');

await client.close();
console.log('MCP_TEST_PASS');
