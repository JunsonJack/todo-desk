# Todo Desk MCP Server

让 Claude Desktop、Cursor、VS Code、MiMo Desktop 等 AI 工具直接读写你的本地待办数据。

数据与桌面应用共用同一个 SQLite 文件：

`C:\Users\Administrator\AppData\Roaming\todo-desktop\data\todo.db`

可用环境变量覆盖路径：

```text
TODO_DB_PATH=D:\backup\todo.db
```

## 启动命令

```bash
node F:\traeWorkData\todo-desktop\mcp\server.cjs
```

或：

```bash
npm --prefix F:\traeWorkData\todo-desktop run mcp
```

## 暴露的工具

| 工具名 | 作用 |
|--------|------|
| `todo_list_tasks` | 按状态/紧急度/项目/日期/关键词列任务 |
| `todo_get_task` | 按 ID 查任务 |
| `todo_create_task` | 创建任务 |
| `todo_update_task` | 更新任务字段 |
| `todo_complete_task` | 标记完成 |
| `todo_reopen_task` | 重新打开 |
| `todo_delete_task` | 删除任务 |
| `todo_list_projects` | 列项目及统计 |
| `todo_create_project` | 创建项目 |
| `todo_update_project` | 更新项目 |
| `todo_delete_project` | 删除项目（任务变未分组） |
| `todo_get_stats` | 总览统计 |
| `todo_list_today` | 今日任务 + 逾期 + 紧急 |

## 字段约定

- `status`: `todo` / `doing` / `done`
- `priority`: `urgent` / `high` / `medium` / `low`
- `due_date`: `YYYY-MM-DD`

## 接入示例

### 1) Claude Desktop

编辑配置文件：

`%APPDATA%\Claude\claude_desktop_config.json`

加入：

```json
{
  "mcpServers": {
    "todo-desktop": {
      "command": "node",
      "args": ["F:\\traeWorkData\\todo-desktop\\mcp\\server.cjs"],
      "env": {
        "TODO_DB_PATH": "C:\\Users\\Administrator\\AppData\\Roaming\\todo-desktop\\data\\todo.db"
      }
    }
  }
}
```

重启 Claude Desktop。

### 2) Cursor

`.cursor/mcp.json` 或全局 MCP 配置：

```json
{
  "mcpServers": {
    "todo-desktop": {
      "command": "node",
      "args": ["F:\\traeWorkData\\todo-desktop\\mcp\\server.cjs"]
    }
  }
}
```

### 3) VS Code (Copilot Chat)

`.vscode/mcp.json`：

```json
{
  "servers": {
    "todo-desktop": {
      "type": "stdio",
      "command": "node",
      "args": ["F:\\traeWorkData\\todo-desktop\\mcp\\server.cjs"]
    }
  }
}
```

### 4) MiMo Desktop

在 `C:\Users\Administrator\.config\mimocode\mimocode.jsonc` 的 `mcp` 段加入：

```json
{
  "todo-desktop": {
    "type": "local",
    "command": [
      "node",
      "F:\\traeWorkData\\todo-desktop\\mcp\\server.cjs"
    ],
    "environment": {
      "TODO_DB_PATH": "C:\\Users\\Administrator\\AppData\\Roaming\\todo-desktop\\data\\todo.db"
    },
    "enabled": true
  }
}
```

写入后需重启引擎或新开对话才会加载。

## 注意事项

1. 桌面应用可以同时开着；SQLite 使用 WAL，一般可并发读写。
2. MCP 的 `stdout` 只走 MCP 协议，日志在 `stderr`。
3. 修改本机数据后，如果桌面应用界面没立刻刷新，切换一下 Tab 或重开应用即可。

## 本地自测

```bash
node F:\traeWorkData\todo-desktop\scripts\test-mcp.mjs
```
