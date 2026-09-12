import React, { useMemo, useState } from 'react';
import TaskCard from '../components/TaskCard.jsx';
import SettingsSelect from '../components/SettingsSelect.jsx';
import { sortByTasks } from '../utils/dates.js';

export default function ListView({
  tasks,
  projects,
  priorities = [],
  priorityMap = null,
  onCreate,
  onEdit,
  onToggleDone,
  onDelete,
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [keyword, setKeyword] = useState('');

  const filtered = useMemo(() => {
    return sortByTasks(tasks.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (projectFilter === 'none') {
        if (t.project_id != null) return false;
      } else if (projectFilter !== 'all' && String(t.project_id) !== projectFilter) {
        return false;
      }
      if (keyword.trim()) {
        const q = keyword.trim().toLowerCase();
        const hay = `${t.title} ${t.description || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }), priorityMap);
  }, [tasks, statusFilter, priorityFilter, projectFilter, keyword, priorityMap]);

  const openCount = tasks.filter((t) => t.status !== 'done').length;

  return (
    <section className="view list-view">
      <header className="view-header">
        <div>
          <h1>任务列表</h1>
          <p className="muted">全部任务总览 · 未完成 {openCount} / 共 {tasks.length}</p>
        </div>
        <button type="button" className="btn create" onClick={onCreate}>
          <span className="btn-plus" aria-hidden="true">+</span>
          新建任务
        </button>
      </header>

      <div className="filter-bar">
        <input
          className="search-input"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索标题或备注..."
        />
        <SettingsSelect
          ariaLabel="状态筛选"
          className="filter-select"
          value={statusFilter}
          options={[
            { id: 'all', label: '全部状态' },
            { id: 'todo', label: '待办' },
            { id: 'doing', label: '进行中' },
            { id: 'done', label: '已完成' },
          ]}
          onChange={setStatusFilter}
        />
        <SettingsSelect
          ariaLabel="紧急程度筛选"
          className="filter-select"
          value={priorityFilter}
          options={[
            { id: 'all', label: '全部紧急度' },
            ...priorities.map((p) => ({ id: p.code, label: p.name, color: p.color })),
          ]}
          onChange={setPriorityFilter}
        />
        <SettingsSelect
          ariaLabel="项目筛选"
          className="filter-select"
          value={projectFilter}
          options={[
            { id: 'all', label: '全部项目' },
            { id: 'none', label: '未分组' },
            ...projects.map((p) => ({ id: String(p.id), label: p.name, color: p.color })),
          ]}
          onChange={setProjectFilter}
        />
      </div>

      <div className="task-list">
        {filtered.length === 0 ? (
          <EmptyState
            title="没有匹配的任务"
            desc="换个筛选条件，或点击右上角新建一条。"
            action={<button type="button" className="btn primary" onClick={onCreate}>新建任务</button>}
          />
        ) : (
          filtered.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              priorityMap={priorityMap}
              onEdit={onEdit}
              onToggleDone={onToggleDone}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </section>
  );
}

export function EmptyState({ title, desc, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">◎</div>
      <h3>{title}</h3>
      <p>{desc}</p>
      {action}
    </div>
  );
}
