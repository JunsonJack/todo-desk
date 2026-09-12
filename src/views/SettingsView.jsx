import React, { useMemo, useState } from 'react';
import SettingsSelect from '../components/SettingsSelect.jsx';

const THEME_OPTIONS = [
  {
    id: 'dark',
    title: '深色',
    desc: '始终使用深色外观',
    icon: '☾',
  },
  {
    id: 'light',
    title: '浅色',
    desc: '始终使用浅色外观',
    icon: '☀',
  },
  {
    id: 'system',
    title: '跟随系统',
    desc: '根据 Windows 外观自动切换',
    icon: '◐',
  },
];

const STATUS_OPTIONS = [
  { id: 'todo', label: '待办' },
  { id: 'doing', label: '进行中' },
  { id: 'done', label: '已完成' },
];

const PRIORITY_COLORS = [
  '#FF453A',
  '#FF9F0A',
  '#FFD60A',
  '#30D158',
  '#64D2FF',
  '#0A84FF',
  '#BF5AF2',
  '#8E8E93',
];

const EMPTY_PRIORITY_FORM = {
  name: '',
  color: PRIORITY_COLORS[3],
};

const MCP_SERVER_PATH = 'F:\\traeWorkData\\todo-desktop\\mcp\\server.cjs';
const DB_PATH = 'C:\\Users\\Administrator\\AppData\\Roaming\\todo-desktop\\data\\todo.db';

const MCP_TABS = [
  {
    id: 'mimo',
    label: 'MiMo Desktop',
    file: 'C:\\Users\\Administrator\\.config\\mimocode\\mimocode.jsonc',
    note: '写入 mcp 段后，重启引擎或新开对话生效。',
    json: `{
  "todo-desktop": {
    "type": "local",
    "command": [
      "node",
      "${MCP_SERVER_PATH}"
    ],
    "environment": {
      "TODO_DB_PATH": "${DB_PATH}"
    },
    "enabled": true
  }
}`,
  },
  {
    id: 'claude',
    label: 'Claude Desktop',
    file: '%APPDATA%\\Claude\\claude_desktop_config.json',
    note: '合并进现有 JSON 的 mcpServers 字段，然后完全退出并重启 Claude Desktop。',
    json: `{
  "todo-desktop": {
    "command": "node",
    "args": ["${MCP_SERVER_PATH}"],
    "env": {
      "TODO_DB_PATH": "${DB_PATH}"
    }
  }
}`,
  },
  {
    id: 'cursor',
    label: 'Cursor',
    file: '.cursor/mcp.json 或用户级 MCP 配置',
    note: '保存后在 Cursor 设置中重新加载 MCP 服务器。',
    json: `{
  "todo-desktop": {
    "command": "node",
    "args": ["${MCP_SERVER_PATH}"]
  }
}`,
  },
  {
    id: 'vscode',
    label: 'VS Code',
    file: '.vscode/mcp.json',
    note: '适用于 Copilot Chat / MCP 客户端扩展。',
    json: `{
  "servers": {
    "todo-desktop": {
      "type": "stdio",
      "command": "node",
      "args": ["${MCP_SERVER_PATH}"]
    }
  }
}`,
  },
];

const MCP_TOOLS = [
  ['todo_list_tasks', '按条件列出任务'],
  ['todo_create_task', '创建任务'],
  ['todo_update_task', '更新任务'],
  ['todo_complete_task', '标记完成'],
  ['todo_delete_task', '删除任务'],
  ['todo_list_today', '今日 + 逾期 + 最高紧急'],
  ['todo_list_projects', '项目与统计'],
  ['todo_list_priorities', '紧急程度列表'],
  ['todo_create_priority', '新建紧急程度'],
  ['todo_get_stats', '总览统计'],
];

export default function SettingsView({
  settings,
  onChange,
  resolvedTheme,
  priorities = [],
  onPrioritySubmit,
  onPriorityDelete,
  onPriorityMove,
  onPriorityReorder,
  onForceRefresh,
}) {
  const set = (key, value) => onChange({ ...settings, [key]: value });
  const [mcpTab, setMcpTab] = useState('mimo');
  const [mcpOpen, setMcpOpen] = useState(false);
  const [copied, setCopied] = useState('');
  const [priorityForm, setPriorityForm] = useState(EMPTY_PRIORITY_FORM);
  const [editingPriorityId, setEditingPriorityId] = useState(null);
  const [priorityError, setPriorityError] = useState('');
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [dropId, setDropId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const priorityOptions = useMemo(
    () => priorities.map((p) => ({ id: p.code, label: p.name, color: p.color })),
    [priorities],
  );

  const activeMcp = useMemo(
    () => MCP_TABS.find((t) => t.id === mcpTab) || MCP_TABS[0],
    [mcpTab],
  );

  const copyText = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 1600);
    } catch {
      setCopied('');
    }
  };

  const submitPriority = async (e) => {
    e.preventDefault();
    setPriorityError('');
    if (typeof onPrioritySubmit !== 'function') {
      setPriorityError('紧急程度保存接口未就绪，请重启应用后重试');
      return;
    }
    if (!priorityForm.name.trim()) {
      setPriorityError('请输入名称');
      return;
    }
    try {
      const existing = editingPriorityId
        ? priorities.find((p) => p.id === editingPriorityId)
        : null;
      await onPrioritySubmit(
        {
          name: priorityForm.name.trim(),
          color: priorityForm.color,
          ...(existing ? {} : { code: undefined }),
        },
        existing,
      );
      setPriorityForm(EMPTY_PRIORITY_FORM);
      setEditingPriorityId(null);
    } catch (err) {
      setPriorityError(err?.message || '保存失败');
    }
  };

  const startEditPriority = (priority) => {
    setEditingPriorityId(priority.id);
    setPriorityForm({ name: priority.name, color: priority.color });
    setPriorityError('');
  };

  const cancelEditPriority = () => {
    setEditingPriorityId(null);
    setPriorityForm(EMPTY_PRIORITY_FORM);
    setPriorityError('');
  };

  const handleDragStart = (e, id) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(id));
    setDragId(id);
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropId !== id) setDropId(id);
  };

  const handleDrop = async (e, targetId) => {
    e.preventDefault();
    const sourceId = Number(e.dataTransfer.getData('text/plain') || dragId);
    setDragId(null);
    setDropId(null);
    if (!sourceId || sourceId === targetId) return;
    if (typeof onPriorityReorder !== 'function') {
      setPriorityError('排序接口未就绪，请重启应用后重试');
      return;
    }

    const ids = priorities.map((p) => p.id);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;

    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, sourceId);
    try {
      setPriorityError('');
      await onPriorityReorder(next);
    } catch (err) {
      setPriorityError(err?.message || '拖拽排序失败');
    }
  };

  return (
    <section className="view settings-view">
      <header className="view-header">
        <div>
          <h1>设置</h1>
          <p className="muted">外观、默认值与 AI 工具接入，仅保存在本机</p>
        </div>
      </header>

      <div className="settings-section">
        <div className="settings-section-title">外观</div>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-label">主题模式</div>
              <div className="settings-hint">
                当前生效：{resolvedTheme === 'dark' ? '深色' : '浅色'}
              </div>
            </div>
          </div>

          <div className="theme-grid">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`theme-card ${settings.theme === opt.id ? 'active' : ''}`}
                onClick={() => set('theme', opt.id)}
              >
                <span className="theme-icon">{opt.icon}</span>
                <span className="theme-title">{opt.title}</span>
                <span className="theme-desc">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">紧急程度</div>
        <div className="settings-card mcp-card">
          <button
            type="button"
            className="settings-row mcp-header"
            onClick={() => setPriorityOpen((v) => !v)}
            aria-expanded={priorityOpen}
          >
            <div>
              <div className="settings-label">维护紧急程度</div>
              <div className="settings-hint">
                支持拖拽排序。最上方为最高紧急度；删除后任务会回落到剩余第一项。
              </div>
            </div>
            <span className="mcp-toggle">{priorityOpen ? '收起' : '展开管理'}</span>
          </button>

          {priorityOpen ? (
            <>
          <div className="priority-list">
            {priorities.map((p, index) => (
              <div
                key={p.id}
                className={[
                  'priority-item',
                  dragId === p.id ? 'is-dragging' : '',
                  dropId === p.id && dragId && dragId !== p.id ? 'is-drop-target' : '',
                ].join(' ')}
                draggable
                onDragStart={(e) => handleDragStart(e, p.id)}
                onDragOver={(e) => handleDragOver(e, p.id)}
                onDragEnter={(e) => handleDragOver(e, p.id)}
                onDragLeave={() => {
                  if (dropId === p.id) setDropId(null);
                }}
                onDrop={(e) => handleDrop(e, p.id)}
                onDragEnd={() => {
                  setDragId(null);
                  setDropId(null);
                }}
              >
                <span className="priority-drag-handle" title="拖拽排序">⣿</span>
                <span className="priority-swatch" style={{ background: p.color }} />
                <div className="priority-item-main">
                  <div className="priority-item-name">{p.name}</div>
                  <div className="settings-hint">
                    {p.code} · 未完成 {p.open_count ?? 0} / 共 {p.task_count ?? 0}
                    {index === 0 ? ' · 最高' : ''}
                  </div>
                </div>
                <div className="priority-item-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    disabled={index === 0}
                    onClick={() => {
                      if (typeof onPriorityMove === 'function') onPriorityMove(p.id, 'up');
                    }}
                    title="上移"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    disabled={index === priorities.length - 1}
                    onClick={() => {
                      if (typeof onPriorityMove === 'function') onPriorityMove(p.id, 'down');
                    }}
                    title="下移"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => startEditPriority(p)}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    disabled={priorities.length <= 1}
                    onClick={async () => {
                      if (typeof onPriorityDelete !== 'function') {
                        setPriorityError('紧急程度删除接口未就绪，请重启应用后重试');
                        return;
                      }
                      if (!window.confirm(`删除紧急程度「${p.name}」？相关任务将回落。`)) return;
                      try {
                        await onPriorityDelete(p);
                      } catch (err) {
                        setPriorityError(err?.message || '删除失败');
                      }
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>

          <form className="priority-form" onSubmit={submitPriority}>
            <div className="settings-label">
              {editingPriorityId ? '编辑紧急程度' : '新增紧急程度'}
            </div>
            <div className="priority-form-row">
              <input
                value={priorityForm.name}
                onChange={(e) => setPriorityForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="名称，例如：阻塞、一般"
                maxLength={20}
              />
              <div className="color-row">
                {PRIORITY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`color-dot ${priorityForm.color.toUpperCase() === c ? 'active' : ''}`}
                    style={{ background: c }}
                    onClick={() => setPriorityForm((f) => ({ ...f, color: c }))}
                    aria-label={c}
                  />
                ))}
                <label
                  className={`color-dot color-custom ${!PRIORITY_COLORS.includes(priorityForm.color.toUpperCase()) ? 'active' : ''}`}
                  style={{ background: priorityForm.color }}
                  title="自定义颜色"
                >
                  <input
                    type="color"
                    value={priorityForm.color}
                    onChange={(e) => setPriorityForm((f) => ({ ...f, color: e.target.value.toUpperCase() }))}
                    aria-label="自定义颜色"
                  />
                  <span className="color-custom-icon">+</span>
                </label>
              </div>
              <div className="priority-form-actions">
                {editingPriorityId ? (
                  <button type="button" className="btn ghost mini" onClick={cancelEditPriority}>
                    取消
                  </button>
                ) : null}
                <button type="submit" className="btn primary mini">
                  {editingPriorityId ? '保存' : '添加'}
                </button>
              </div>
            </div>
            {priorityError ? <p className="form-error">{priorityError}</p> : null}
          </form>
            </>
          ) : null}
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">新建任务默认值</div>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-label">默认紧急程度</div>
              <div className="settings-hint">打开新建任务时的初始紧急程度</div>
            </div>
            <SettingsSelect
              ariaLabel="默认紧急程度"
              value={
                priorityOptions.some((o) => o.id === settings.defaultPriority)
                  ? settings.defaultPriority
                  : (priorityOptions[0]?.id || '')
              }
              options={priorityOptions}
              onChange={(v) => set('defaultPriority', v)}
            />
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">默认状态</div>
              <div className="settings-hint">新建任务时的初始状态</div>
            </div>
            <SettingsSelect
              ariaLabel="默认状态"
              value={settings.defaultStatus}
              options={STATUS_OPTIONS}
              onChange={(v) => set('defaultStatus', v)}
            />
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">MCP 服务</div>
        <div className="settings-card mcp-card">
          <button
            type="button"
            className="settings-row mcp-header"
            onClick={() => setMcpOpen((v) => !v)}
            aria-expanded={mcpOpen}
          >
            <div>
              <div className="settings-label">接入 AI 工具</div>
              <div className="settings-hint">
                让 Claude / Cursor / MiMo 等直接读写本机待办数据
              </div>
            </div>
            <span className="mcp-toggle">{mcpOpen ? '收起' : '查看指南'}</span>
          </button>

          {mcpOpen ? (
            <div className="mcp-body">
              <div className="mcp-meta">
                <div>
                  <span className="mcp-meta-label">启动命令</span>
                  <code className="mcp-code-line">node {MCP_SERVER_PATH}</code>
                  <button
                    type="button"
                    className="btn ghost mini"
                    onClick={() => copyText(`node ${MCP_SERVER_PATH}`, 'cmd')}
                  >
                    {copied === 'cmd' ? '已复制' : '复制命令'}
                  </button>
                </div>
                <div>
                  <span className="mcp-meta-label">数据库路径</span>
                  <code className="mcp-code-line">{DB_PATH}</code>
                  <button
                    type="button"
                    className="btn ghost mini"
                    onClick={() => copyText(DB_PATH, 'db')}
                  >
                    {copied === 'db' ? '已复制' : '复制路径'}
                  </button>
                </div>
              </div>

              <div className="mcp-tabs" role="tablist" aria-label="MCP 客户端">
                {MCP_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={mcpTab === tab.id}
                    className={`mcp-tab ${mcpTab === tab.id ? 'active' : ''}`}
                    onClick={() => setMcpTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="mcp-panel">
                <div className="mcp-panel-head">
                  <div>
                    <div className="settings-label">配置文件</div>
                    <div className="settings-hint mono">{activeMcp.file}</div>
                  </div>
                  <button
                    type="button"
                    className="btn primary mini"
                    onClick={() => copyText(activeMcp.json, activeMcp.id)}
                  >
                    {copied === activeMcp.id ? '已复制 JSON' : '复制配置'}
                  </button>
                </div>
                <pre className="mcp-json">{activeMcp.json}</pre>
                <p className="mcp-note">{activeMcp.note}</p>
              </div>

              <div className="mcp-tools">
                <div className="settings-label">可用工具（节选）</div>
                <div className="mcp-tool-grid">
                  {MCP_TOOLS.map(([name, desc]) => (
                    <div key={name} className="mcp-tool">
                      <code>{name}</code>
                      <span>{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">关于</div>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-label">应用</div>
              <div className="settings-hint">Todo Desk · 本地待办工作台</div>
            </div>
            <div className="about-actions">
              <span className="settings-badge">v1.0.0</span>
              <button
                type="button"
                className="btn ghost mini"
                title="重新加载任务、项目与紧急程度数据"
                disabled={refreshing}
                onClick={async () => {
                  setRefreshing(true);
                  try {
                    if (typeof onForceRefresh === 'function') {
                      await onForceRefresh();
                    } else {
                      window.location.reload();
                      return;
                    }
                    setCopied('refresh');
                    setTimeout(() => setCopied(''), 1200);
                  } finally {
                    setRefreshing(false);
                  }
                }}
              >
                {refreshing ? '刷新中...' : (copied === 'refresh' ? '已刷新' : '强制刷新')}
              </button>
            </div>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-label">数据位置</div>
              <div className="settings-hint mono">
                %APPDATA%\todo-desktop\data\todo.db
              </div>
            </div>
            <button
              type="button"
              className="btn ghost mini"
              onClick={() => copyText(DB_PATH, 'about-db')}
            >
              {copied === 'about-db' ? '已复制' : '复制路径'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
