import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API, NAV_ITEMS } from './utils/api.js';
import { todayStr, buildPriorityMap } from './utils/dates.js';
import {
  applyTheme,
  loadSettings,
  resolveTheme,
  saveSettings,
} from './utils/settings.js';
import ListView from './views/ListView.jsx';
import TodayView from './views/TodayView.jsx';
import WeekView from './views/WeekView.jsx';
import CalendarView from './views/CalendarView.jsx';
import ProjectView from './views/ProjectView.jsx';
import SettingsView from './views/SettingsView.jsx';
import TaskModal from './components/TaskModal.jsx';
import ProjectModal from './components/ProjectModal.jsx';

export default function App() {
  const [tab, setTab] = useState('today');
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(() => loadSettings());
  const [resolvedTheme, setResolvedTheme] = useState(() => resolveTheme(loadSettings().theme));

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

  const priorityMap = useMemo(() => buildPriorityMap(priorities), [priorities]);

  useEffect(() => {
    const resolved = applyTheme(settings.theme);
    setResolvedTheme(resolved);

    if (settings.theme !== 'system') return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolvedTheme(applyTheme('system'));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [settings.theme]);

  const handleSettingsChange = useCallback((next) => {
    const saved = saveSettings(next);
    setSettings(saved);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [taskList, projectList, priorityList, statsData] = await Promise.all([
        API.tasks.list({}),
        API.projects.list(),
        API.priorities.list(),
        API.stats.get(),
      ]);
      setTasks(taskList);
      setProjects(projectList);
      setPriorities(priorityList);
      setStats(statsData);
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

  const handleDeleteTask = useCallback(async (task) => {
    if (!window.confirm(`删除任务「${task.title}」？`)) return;
    await API.tasks.remove(task.id);
    await refresh();
  }, [refresh]);

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
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">T</div>
          <div>
            <div className="brand-name">Todo Desk</div>
            <div className="brand-sub">本地待办工作台</div>
          </div>
        </div>

        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${tab === item.id ? 'active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'list' ? <span className="nav-badge">{openCount}</span> : null}
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
          <button type="button" className="btn primary block" onClick={() => openCreateTask()}>
            + 新建任务
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
                onForceRefresh={handleForceRefresh}
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
    </div>
  );
}
