import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API, NAV_ITEMS } from './utils/api.js';
import { todayStr, buildPriorityMap } from './utils/dates.js';
import {
  applyTheme,
  applyWallpaper,
  loadSettings,
  resolveTheme,
  saveSettings,
} from './utils/settings.js';
import ListView from './views/ListView.jsx';
import TodayView from './views/TodayView.jsx';
import WeekView from './views/WeekView.jsx';
import CalendarView from './views/CalendarView.jsx';
import ProjectView from './views/ProjectView.jsx';
import NotesView from './views/NotesView.jsx';
import SettingsView from './views/SettingsView.jsx';
import TaskModal from './components/TaskModal.jsx';
import ProjectModal from './components/ProjectModal.jsx';
import NoteModal from './components/NoteModal.jsx';
import CategoryModal from './components/CategoryModal.jsx';
import ConfirmModal from './components/ConfirmModal.jsx';

export default function App() {
  const [tab, setTab] = useState('today');
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [notes, setNotes] = useState([]);
  const [noteCategories, setNoteCategories] = useState([]);
  const [noteStats, setNoteStats] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(() => loadSettings());
  const [resolvedTheme, setResolvedTheme] = useState(() => resolveTheme(loadSettings().theme));
  const [taskConfirm, setTaskConfirm] = useState({ open: false, task: null });

  const [taskModal, setTaskModal] = useState({
    open: false,
    task: null,
    defaultDate: null,
    projectId: null,
  });
  const [projectModal, setProjectModal] = useState({
    open: false,
    project: null,
  });
  const [noteModal, setNoteModal] = useState({
    open: false,
    note: null,
    categoryId: null,
  });
  const [categoryModal, setCategoryModal] = useState({ open: false });
  const [notesArchived, setNotesArchived] = useState(false);
  const notesArchivedRef = useRef(false);

  const priorityMap = useMemo(() => buildPriorityMap(priorities), [priorities]);

  useEffect(() => {
    const resolved = applyTheme(settings.theme);
    setResolvedTheme(resolved);
    applyWallpaper(settings);

    if (settings.theme !== 'system') return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolvedTheme(applyTheme('system'));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [settings.theme, settings.wallpaper, settings.wallpaperImage, settings.wallpaperOpacity]);

  const handleSettingsChange = useCallback((next) => {
    try {
      const saved = saveSettings(next);
      setSettings(saved);
      setError('');
    } catch (err) {
      setError(err?.message || '设置保存失败');
      setSettings(loadSettings());
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [taskList, projectList, priorityList, statsData, noteList, categoryList, nStats] = await Promise.all([
        API.tasks.list({}),
        API.projects.list(),
        API.priorities.list(),
        API.stats.get(),
        API.notes.list({ archived: notesArchivedRef.current }),
        API.noteCategories.list(),
        API.notes.stats(),
      ]);
      setTasks(taskList);
      setProjects(projectList);
      setPriorities(priorityList);
      setStats(statsData);
      setNotes(noteList);
      setNoteCategories(categoryList);
      setNoteStats(nStats);
      setError('');
    } catch (err) {
      setError(err?.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openCreateTask = useCallback((defaults = {}) => {
    setTaskModal({
      open: true,
      task: null,
      defaultDate: defaults.due_date || todayStr(),
      projectId: defaults.project_id ?? null,
    });
  }, []);

  const openEditTask = useCallback((task) => {
    setTaskModal({ open: true, task, defaultDate: null, projectId: null });
  }, []);

  const closeTaskModal = useCallback(() => {
    setTaskModal({ open: false, task: null, defaultDate: null, projectId: null });
  }, []);

  const handleTaskSubmit = useCallback(async (payload, existing) => {
    if (existing) {
      await API.tasks.update(existing.id, payload);
    } else {
      await API.tasks.create(payload);
    }
    await refresh();
  }, [refresh]);

  const handleToggleDone = useCallback(async (task) => {
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    await API.tasks.update(task.id, { status: nextStatus });
    await refresh();
  }, [refresh]);

  const handleDeleteTask = useCallback((task) => {
    setTaskConfirm({ open: true, task });
  }, []);

  const confirmDeleteTask = useCallback(async () => {
    const task = taskConfirm.task;
    if (!task) return;
    await API.tasks.remove(task.id);
    setTaskConfirm({ open: false, task: null });
    await refresh();
  }, [taskConfirm.task, refresh]);

  const handleProjectSubmit = useCallback(async (payload, existing) => {
    if (existing) {
      await API.projects.update(existing.id, payload);
    } else {
      await API.projects.create(payload);
    }
    await refresh();
  }, [refresh]);

  const handleInlineCreateProject = useCallback(async ({ name, color }) => {
    const created = await API.projects.create({ name, color: color || '#6C8EFF' });
    await refresh();
    return created;
  }, [refresh]);

  const handleDeleteProject = useCallback(async (project) => {
    await API.projects.remove(project.id);
    await refresh();
  }, [refresh]);

  const handlePrioritySubmit = useCallback(async (payload, existing) => {
    if (existing) {
      await API.priorities.update(existing.id, payload);
    } else {
      await API.priorities.create(payload);
    }
    await refresh();
  }, [refresh]);

  const handleDeletePriority = useCallback(async (priority) => {
    await API.priorities.remove(priority.id);
    await refresh();
  }, [refresh]);

  const handleMovePriority = useCallback(async (id, direction) => {
    await API.priorities.move(id, direction);
    await refresh();
  }, [refresh]);

  const handleReorderPriority = useCallback(async (orderedIds) => {
    await API.priorities.reorder(orderedIds);
    await refresh();
  }, [refresh]);

  const handleForceRefresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const handleExportData = useCallback(async () => {
    const payload = await API.data.exportAll();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `todo-desk-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return payload.counts;
  }, []);

  const handleImportData = useCallback(async (payload, mode = 'replace') => {
    const result = await API.data.importAll(payload, mode);
    await refresh();
    return result;
  }, [refresh]);

  const openCreateNote = useCallback((defaults = {}) => {
    setNoteModal({
      open: true,
      note: null,
      categoryId: defaults.category_id ?? null,
    });
  }, []);

  const openEditNote = useCallback((note) => {
    setNoteModal({ open: true, note, categoryId: null });
  }, []);

  const closeNoteModal = useCallback(() => {
    setNoteModal({ open: false, note: null, categoryId: null });
  }, []);

  const handleNoteSubmit = useCallback(async (payload, existing) => {
    if (existing) {
      await API.notes.update(existing.id, payload);
    } else {
      await API.notes.create(payload);
    }
    await refresh();
  }, [refresh]);

  const handleNotePin = useCallback(async (note) => {
    await API.notes.update(note.id, { pinned: !note.pinned });
    await refresh();
  }, [refresh]);

  const handleNoteArchive = useCallback(async (note, archived = true) => {
    await API.notes.update(note.id, { archived });
    // If viewing the same archive state after toggle, keep that view.
    // Archive from active list -> note leaves active; unarchive from archive list -> leaves archive.
    // refresh uses notesArchivedRef which NotesView updates via handleLoadNotes.
    await refresh();
  }, [refresh]);

  const handleNoteDelete = useCallback(async (note) => {
    await API.notes.remove(note.id);
    await refresh();
  }, [refresh]);

  const handleCategorySubmit = useCallback(async (payload) => {
    await API.noteCategories.create(payload);
    await refresh();
  }, [refresh]);

  const handleLoadNotes = useCallback(async (filters = {}) => {
    if (filters.archived !== undefined) {
      setNotesArchived(!!filters.archived);
      notesArchivedRef.current = !!filters.archived;
    }
    const list = await API.notes.list({
      archived: notesArchivedRef.current,
    });
    setNotes(list);
    const [categoryList, nStats] = await Promise.all([
      API.noteCategories.list(),
      API.notes.stats(),
    ]);
    setNoteCategories(categoryList);
    setNoteStats(nStats);
  }, []);

  const openCount = useMemo(
    () => tasks.filter((t) => t.status !== 'done').length,
    [tasks],
  );

  const viewProps = {
    tasks,
    projects,
    priorities,
    priorityMap,
    stats,
    onCreate: openCreateTask,
    onCreateTask: openCreateTask,
    onCreateProject: () => setProjectModal({ open: true, project: null }),
    onEditProject: (project) => setProjectModal({ open: true, project }),
    onEdit: openEditTask,
    onToggleDone: handleToggleDone,
    onDelete: handleDeleteTask,
  };

  return (
    <div
      className={`app-shell ${settings.sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
      data-wallpaper={settings.wallpaper || 'default'}
    >
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">T</div>
          <div className="brand-text">
            <div className="brand-name">Todo Desk</div>
            <div className="brand-sub">本地待办工作台</div>
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            title={settings.sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
            aria-label={settings.sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
            onClick={() => handleSettingsChange({ ...settings, sidebarCollapsed: !settings.sidebarCollapsed })}
          >
            <span className="sidebar-toggle-icon" aria-hidden="true">
              {settings.sidebarCollapsed ? '»' : '«'}
            </span>
          </button>
        </div>

        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${tab === item.id ? 'active' : ''}`}
              onClick={() => setTab(item.id)}
              title={settings.sidebarCollapsed ? item.label : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.id === 'list' ? (
                <span className="nav-badge">{openCount}</span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {stats ? (
            <div className="mini-stats">
              <div>
                <span className="mini-label">总任务</span>
                <strong>{stats.total}</strong>
              </div>
              <div>
                <span className="mini-label">已完成</span>
                <strong>{stats.done}</strong>
              </div>
              <div>
                <span className="mini-label">逾期</span>
                <strong className={stats.overdue ? 'text-danger' : ''}>{stats.overdue}</strong>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            className="btn create sidebar-cta"
            onClick={() => openCreateTask()}
            title={settings.sidebarCollapsed ? '新建任务' : undefined}
          >
            <span className="btn-plus" aria-hidden="true">+</span>
            <span className="btn-label">新建任务</span>
          </button>
        </div>
      </aside>

      <main className="main">
        {error ? <div className="banner error">{error}</div> : null}
        {loading ? (
          <div className="loading">加载中...</div>
        ) : (
          <>
            {tab === 'list' ? <ListView {...viewProps} /> : null}
            {tab === 'today' ? <TodayView {...viewProps} /> : null}
            {tab === 'week' ? <WeekView {...viewProps} /> : null}
            {tab === 'calendar' ? <CalendarView {...viewProps} /> : null}
            {tab === 'project' ? <ProjectView {...viewProps} /> : null}
            {tab === 'notes' ? (
              <NotesView
                notes={notes}
                categories={noteCategories}
                noteStats={noteStats}
                onCreate={openCreateNote}
                onEdit={openEditNote}
                onPin={handleNotePin}
                onArchive={handleNoteArchive}
                onDelete={handleNoteDelete}
                onCreateCategory={() => setCategoryModal({ open: true })}
                onRefresh={handleLoadNotes}
              />
            ) : null}
            {tab === 'settings' ? (
              <SettingsView
                settings={settings}
                resolvedTheme={resolvedTheme}
                onChange={handleSettingsChange}
                priorities={priorities}
                onPrioritySubmit={handlePrioritySubmit}
                onPriorityDelete={handleDeletePriority}
                onPriorityMove={handleMovePriority}
                onPriorityReorder={handleReorderPriority}
                onExportData={handleExportData}
                onImportData={handleImportData}
              />
            ) : null}
          </>
        )}
      </main>

      <TaskModal
        open={taskModal.open}
        task={taskModal.task}
        projects={projects}
        priorities={priorities}
        defaultDate={taskModal.defaultDate}
        defaultProjectId={taskModal.projectId}
        defaultPriority={settings.defaultPriority}
        defaultStatus={settings.defaultStatus}
        onClose={closeTaskModal}
        onSubmit={handleTaskSubmit}
        onCreateProject={handleInlineCreateProject}
        onManageProjects={() => setProjectModal({ open: true, project: null })}
      />

      <ProjectModal
        open={projectModal.open}
        project={projectModal.project}
        onClose={() => setProjectModal({ open: false, project: null })}
        onSubmit={handleProjectSubmit}
        onDelete={handleDeleteProject}
      />

      <NoteModal
        open={noteModal.open}
        note={noteModal.note}
        categories={noteCategories}
        defaultCategoryId={noteModal.categoryId}
        onClose={closeNoteModal}
        onSubmit={handleNoteSubmit}
      />

      <CategoryModal
        open={categoryModal.open}
        onClose={() => setCategoryModal({ open: false })}
        onSubmit={handleCategorySubmit}
      />

      <ConfirmModal
        open={taskConfirm.open}
        title="删除任务"
        message={taskConfirm.task ? `确定删除「${taskConfirm.task.title}」？此操作无法撤销。` : ''}
        confirmText="删除"
        danger
        onConfirm={confirmDeleteTask}
        onCancel={() => setTaskConfirm({ open: false, task: null })}
      />
    </div>
  );
}
