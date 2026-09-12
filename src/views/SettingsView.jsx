import React, { useMemo, useState } from 'react';
import SettingsSelect from '../components/SettingsSelect.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import ImportModeModal from '../components/ImportModeModal.jsx';
import { WALLPAPER_PRESETS } from '../utils/settings.js';

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
  onExportData,
  onImportData,
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
  const [ioBusy, setIoBusy] = useState(false);
  const [ioMsg, setIoMsg] = useState('');
  const [updateBusy, setUpdateBusy] = useState(false);
  const [ioConfirm, setIoConfirm] = useState({
    open: false,
    title: '',
    message: '',
    confirmText: '确定',
    danger: false,
    onConfirm: null,
  });
  const [importModeOpen, setImportModeOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const fileInputRef = React.useRef(null);

  const openIoConfirm = (options) => {
    setIoConfirm({
      open: true,
      title: options.title || '确认操作',
      message: options.message || '',
      confirmText: options.confirmText || '确定',
      danger: options.danger !== false,
      onConfirm: options.onConfirm,
    });
  };

  const closeIoConfirm = () => {
    setIoConfirm((s) => ({ ...s, open: false, onConfirm: null }));
  };

  const CURRENT_VERSION = '1.0.0';

  function parseVersion(v) {
    return String(v || '')
      .replace(/^v/i, '')
      .split('.')
      .map((n) => Number.parseInt(n, 10) || 0);
  }

  function isNewerVersion(a, b) {
    const av = parseVersion(a);
    const bv = parseVersion(b);
    for (let i = 0; i < Math.max(av.length, bv.length); i += 1) {
      const d = (av[i] || 0) - (bv[i] || 0);
      if (d !== 0) return d > 0;
    }
    return false;
  }

  const handleCheckUpdate = async () => {
    setUpdateBusy(true);
    try {
      const res = await fetch('https://api.github.com/repos/JunsonJack/todo-desk/releases/latest', {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) {
        throw new Error(`获取更新信息失败（HTTP ${res.status}）`);
      }
      const release = await res.json();
      const latest = String(release.tag_name || release.name || '').replace(/^v/i, '');
      const assets = Array.isArray(release.assets) ? release.assets : [];
      const hasExe = assets.some((a) => /\.exe$/i.test(a.name || ''));

      if (!latest) {
        openIoConfirm({
          title: '检查更新',
          message: '未找到版本信息，当前可能是最新版或仓库尚未发布 Release。',
          confirmText: '知道了',
          danger: false,
          onConfirm: () => closeIoConfirm(),
        });
        return;
      }

      if (isNewerVersion(latest, CURRENT_VERSION)) {
        openIoConfirm({
          title: '发现新版本',
          message: `发现更新 v${latest}，当前 v${CURRENT_VERSION}。${hasExe ? '请到 GitHub Release 页面下载安装包。' : 'Release 暂未附带 exe，请到仓库页面查看。'}`,
          confirmText: '打开下载页',
          danger: false,
          onConfirm: () => {
            window.open(release.html_url || 'https://github.com/JunsonJack/todo-desk/releases', '_blank');
            closeIoConfirm();
          },
        });
        return;
      }

      openIoConfirm({
        title: '已是最新版本',
        message: `当前 v${CURRENT_VERSION}，GitHub 最新为 v${latest}。`,
        confirmText: '好的',
        danger: false,
        onConfirm: () => closeIoConfirm(),
      });
    } catch (err) {
      openIoConfirm({
        title: '检查更新失败',
        message: err?.message || '无法连接 GitHub，请稍后重试。',
        confirmText: '知道了',
        danger: true,
        onConfirm: () => closeIoConfirm(),
      });
    } finally {
      setUpdateBusy(false);
    }
  };

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

  const handleExportClick = async () => {
    setIoBusy(true);
    setIoMsg('');
    try {
      if (typeof onExportData !== 'function') {
        throw new Error('导出接口未就绪，请重启应用');
      }
      const counts = await onExportData();
      const msg = counts
        ? `已导出 JSON 备份：任务 ${counts.tasks} · 项目 ${counts.projects} · 琐事 ${counts.notes}`
        : '已导出 JSON 备份';
      setIoMsg(msg);
      openIoConfirm({
        title: '导出完成',
        message: msg,
        confirmText: '好的',
        danger: false,
        onConfirm: () => closeIoConfirm(),
      });
    } catch (err) {
      const msg = err?.message || '导出失败';
      setIoMsg(msg);
      openIoConfirm({
        title: '导出失败',
        message: msg,
        confirmText: '知道了',
        danger: true,
        onConfirm: () => closeIoConfirm(),
      });
    } finally {
      setIoBusy(false);
    }
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    setIoBusy(true);
    setIoMsg('');
    try {
      if (typeof onImportData !== 'function') {
        throw new Error('导入接口未就绪，请重启应用');
      }
      const text = await file.text();
      const payload = JSON.parse(text);
      setPendingImport({ payload, fileName: file.name });
      setImportModeOpen(true);
    } catch (err) {
      const msg = err?.message || '导入失败，请检查 JSON 文件';
      setIoMsg(msg);
      openIoConfirm({
        title: '导入失败',
        message: msg,
        confirmText: '知道了',
        danger: true,
        onConfirm: () => closeIoConfirm(),
      });
    } finally {
      setIoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const runImport = async (mode) => {
    if (!pendingImport) return;
    setImportModeOpen(false);
    setIoBusy(true);
    try {
      const result = await onImportData(pendingImport.payload, mode);
      const totals = result?.totals || result?.counts || result;
      const msg = mode === 'merge'
        ? `增量添加完成：新增任务 ${result?.added?.tasks ?? 0} · 新增琐事 ${result?.added?.notes ?? 0} · 当前任务 ${totals?.tasks ?? '-'} · 当前琐事 ${totals?.notes ?? '-'}`
        : `全量覆盖完成：任务 ${totals?.tasks ?? '-'} · 项目 ${totals?.projects ?? '-'} · 琐事 ${totals?.notes ?? '-'}`;
      setIoMsg(msg);
      openIoConfirm({
        title: '导入完成',
        message: msg,
        confirmText: '好的',
        danger: false,
        onConfirm: () => closeIoConfirm(),
      });
    } catch (err) {
      const msg = err?.message || '导入失败';
      setIoMsg(msg);
      openIoConfirm({
        title: '导入失败',
        message: msg,
        confirmText: '知道了',
        danger: true,
        onConfirm: () => closeIoConfirm(),
      });
    } finally {
      setIoBusy(false);
      setPendingImport(null);
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

  const applyWallpaperPatch = (patch) => {
    onChange({
      ...settings,
      ...patch,
      wallpaperOpacity: patch.wallpaperOpacity ?? settings.wallpaperOpacity ?? 0.55,
    });
  };

  const readImageAsDataUrl = async (file) => {
    const raw = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('读取图片失败'));
      reader.readAsDataURL(file);
    });

    // Downscale to keep localStorage manageable
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('图片解析失败'));
      image.src = raw;
    });

    const maxW = 1600;
    const scale = Math.min(1, maxW / img.naturalWidth);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.78);
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
        <div className="settings-section-title">窗口背景</div>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-label">背景样式</div>
              <div className="settings-hint">预设渐变或自定义图片，实时预览</div>
            </div>
          </div>

          <div className="wallpaper-grid">
            {WALLPAPER_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`wallpaper-card ${settings.wallpaper === p.id ? 'active' : ''} wp-${p.id}`}
                onClick={() => set('wallpaper', p.id)}
              >
                <span className="wallpaper-preview" aria-hidden="true" />
                <span className="wallpaper-title">{p.label}</span>
                <span className="theme-desc">{p.desc}</span>
              </button>
            ))}
            <button
              type="button"
              className={`wallpaper-card ${settings.wallpaper === 'custom' ? 'active' : ''} wp-custom`}
              onClick={() => document.getElementById('wallpaper-file-input')?.click()}
            >
              <span
                className="wallpaper-preview custom-preview"
                style={settings.wallpaperImage ? { backgroundImage: `url(${settings.wallpaperImage})` } : undefined}
                aria-hidden="true"
              />
              <span className="wallpaper-title">自定义图片</span>
              <span className="theme-desc">
                {settings.wallpaper === 'custom' && settings.wallpaperImage
                  ? '点击可更换图片'
                  : '选择本地图片'}
              </span>
            </button>
            <input
              id="wallpaper-file-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                if (!file.type.startsWith('image/')) {
                  openIoConfirm({
                    title: '格式不支持',
                    message: '请选择图片文件（jpg/png/webp 等）',
                    confirmText: '知道了',
                    danger: true,
                    onConfirm: () => closeIoConfirm(),
                  });
                  return;
                }
                try {
                  setIoBusy(true);
                  const dataUrl = await readImageAsDataUrl(file);
                  applyWallpaperPatch({
                    wallpaper: 'custom',
                    wallpaperImage: dataUrl,
                  });
                } catch (err) {
                  openIoConfirm({
                    title: '设置背景失败',
                    message: err?.message || '无法读取该图片',
                    confirmText: '知道了',
                    danger: true,
                    onConfirm: () => closeIoConfirm(),
                  });
                } finally {
                  setIoBusy(false);
                }
              }}
            />
          </div>

          {settings.wallpaper === 'custom' ? (
            <div className="settings-row">
              <div>
                <div className="settings-label">图片透明度</div>
                <div className="settings-hint">数值越低越接近纯色底</div>
              </div>
              <input
                type="range"
                min="0.2"
                max="0.9"
                step="0.05"
                value={settings.wallpaperOpacity ?? 0.55}
                onChange={(e) => set('wallpaperOpacity', Number(e.target.value))}
                className="wallpaper-range"
              />
            </div>
          ) : null}

          {settings.wallpaper === 'custom' ? (
            <div className="settings-row">
              <div>
                <div className="settings-label">清除图片</div>
                <div className="settings-hint">恢复为默认背景</div>
              </div>
              <button
                type="button"
                className="btn ghost mini"
                onClick={() => applyWallpaperPatch({ wallpaper: 'default', wallpaperImage: '' })}
              >
                清除
              </button>
            </div>
          ) : null}
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
                    onClick={() => {
                      if (typeof onPriorityDelete !== 'function') {
                        setPriorityError('紧急程度删除接口未就绪，请重启应用后重试');
                        return;
                      }
                      openIoConfirm({
                        title: '删除紧急程度',
                        message: `删除「${p.name}」？相关任务将回落到剩余第一项。`,
                        confirmText: '删除',
                        danger: true,
                        onConfirm: async () => {
                          try {
                            await onPriorityDelete(p);
                          } catch (err) {
                            setPriorityError(err?.message || '删除失败');
                          }
                          closeIoConfirm();
                        },
                      });
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
        <div className="settings-section-title">数据</div>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-label">导出备份</div>
              <div className="settings-hint">
                导出任务、项目、紧急程度、琐事与分类为 JSON 文件
              </div>
            </div>
            <button
              type="button"
              className="btn primary mini"
              disabled={ioBusy}
              onClick={handleExportClick}
            >
              {ioBusy ? '处理中...' : '导出 JSON'}
            </button>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-label">导入恢复</div>
              <div className="settings-hint">
                从备份 JSON 恢复；会覆盖当前库内全部数据
              </div>
            </div>
            <button
              type="button"
              className="btn ghost mini"
              disabled={ioBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              选择文件导入
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => handleImportFile(e.target.files?.[0])}
            />
          </div>
          {ioMsg ? (
            <div className="settings-row">
              <div className="settings-hint">{ioMsg}</div>
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
              <span className="settings-badge">v{CURRENT_VERSION}</span>
              <button
                type="button"
                className="btn ghost mini"
                title="检查 GitHub 上是否有新版本"
                disabled={updateBusy}
                onClick={handleCheckUpdate}
              >
                {updateBusy ? '检查中...' : '检查更新'}
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

      <ConfirmModal
        open={ioConfirm.open}
        title={ioConfirm.title}
        message={ioConfirm.message}
        confirmText={ioConfirm.confirmText}
        danger={ioConfirm.danger}
        onConfirm={ioConfirm.onConfirm}
        onCancel={closeIoConfirm}
      />

      <ImportModeModal
        open={importModeOpen}
        fileName={pendingImport?.fileName || ''}
        onCancel={() => {
          setImportModeOpen(false);
          setPendingImport(null);
          setIoMsg('已取消导入');
        }}
        onMerge={() => runImport('merge')}
        onReplace={() => runImport('replace')}
      />
    </section>
  );
}
