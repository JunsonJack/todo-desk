import React, { useMemo } from 'react';
import TaskCard from '../components/TaskCard.jsx';
import { EmptyState } from './ListView.jsx';
import { sortByTasks, todayStr, formatDateCN } from '../utils/dates.js';

export default function TodayView({
  tasks,
  stats,
  priorities = [],
  priorityMap = null,
  onCreate,
  onEdit,
  onToggleDone,
  onDelete,
}) {
  const today = todayStr();
  const topPriority = priorities[0]?.code || stats?.topPriority || 'urgent';

  const { todayTasks, overdueTasks, urgentOpen } = useMemo(() => {
    const todayList = tasks.filter((t) => t.due_date === today);
    const overdue = tasks.filter((t) => t.due_date && t.due_date < today && t.status !== 'done');
    const urgent = tasks.filter((t) => t.priority === topPriority && t.status !== 'done');
    return {
      todayTasks: sortByTasks(todayList, priorityMap),
      overdueTasks: sortByTasks(overdue, priorityMap),
      urgentOpen: urgent,
    };
  }, [tasks, today, priorityMap, topPriority]);

  const doneToday = todayTasks.filter((t) => t.status === 'done').length;
  const progress = todayTasks.length === 0
    ? 0
    : Math.round((doneToday / todayTasks.length) * 100);

  return (
    <section className="view today-view">
      <header className="view-header">
        <div>
          <h1>今日</h1>
          <p className="muted">{formatDateCN(today)} · 完成 {doneToday}/{todayTasks.length} · 进度 {progress}%</p>
        </div>
        <button type="button" className="btn create" onClick={() => onCreate({ due_date: today })}>
          <span className="btn-plus" aria-hidden="true">+</span>
          添加今日任务
        </button>
      </header>

      <div className="stat-grid">
        <StatCard label="今日任务" value={todayTasks.length} accent="#6C8EFF" />
        <StatCard label="已完成" value={doneToday} accent="#5BB89A" />
        <StatCard label="逾期未完成" value={overdueTasks.length} accent="#E56B8A" />
        <StatCard label="全局紧急" value={urgentOpen.length} accent="#F0A45D" />
      </div>

      <div className="progress-block">
        <div className="progress-label">
          <span>今日进度</span>
          <span>{progress}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {overdueTasks.length > 0 ? (
        <div className="section-block today-section overdue-section">
          <div className="section-title danger-title">
            <span>需要尽快处理 · 逾期 {overdueTasks.length}</span>
          </div>
          <div className="task-list today-task-list">
            {overdueTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                priorityMap={priorityMap}
                onEdit={onEdit}
                onToggleDone={onToggleDone}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="section-block today-section schedule-section">
        <div className="section-title">
          <span>今天的安排</span>
          <span className="muted">{todayTasks.length} 项</span>
        </div>
        <div className="task-list today-task-list">
          {todayTasks.length === 0 ? (
            <EmptyState
              title="今天还没有安排"
              desc="把要做的事放到今日，打开就能看见。"
              action={(
                <button type="button" className="btn primary" onClick={() => onCreate({ due_date: today })}>
                  添加今日任务
                </button>
              )}
            />
          ) : (
            todayTasks.map((task) => (
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
      </div>
    </section>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="stat-card" style={{ '--accent': accent }}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
