import React from 'react';
import { STATUS_META, getPriorityMeta, isOverdue } from '../utils/dates.js';

export default function TaskCard({
  task,
  onEdit,
  onToggleDone,
  onDelete,
  priorityMap = null,
  compact = false,
  showDate = true,
}) {
  const status = STATUS_META[task.status];
  const priority = getPriorityMeta(task, priorityMap);
  const overdue = isOverdue(task);
  const done = task.status === 'done';

  return (
    <div
      className={[
        'task-card',
        done ? 'is-done' : '',
        overdue ? 'is-overdue' : '',
        compact ? 'is-compact' : '',
      ].join(' ')}
    >
      <button
        type="button"
        className="check-btn"
        title={done ? '标记为待办' : '标记为完成'}
        onClick={() => onToggleDone(task)}
      >
        {done ? '✓' : ''}
      </button>

      <div className="task-main">
        <div className="task-title-row">
          <span className="task-title">{task.title}</span>
          <span
            className="priority-chip p-dynamic"
            style={{
              '--chip-color': priority.color,
              background: `color-mix(in srgb, ${priority.color} 18%, transparent)`,
              color: priority.color,
            }}
          >
            {priority.short || priority.label}
          </span>
        </div>

        {!compact && task.description ? (
          <p className="task-desc">{task.description}</p>
        ) : null}

        <div className="task-meta">
          <span className={`status-chip ${status.className}`}>{status.label}</span>
          {task.project_name ? (
            <span className="project-chip" style={{ '--chip-color': task.project_color || '#6C8EFF' }}>
              {task.project_name}
            </span>
          ) : (
            <span className="project-chip muted">未分组</span>
          )}
          {showDate && task.due_date ? (
            <span className={`due-chip ${overdue ? 'overdue' : ''}`}>
              {overdue ? '已逾期 · ' : ''}{task.due_date}
            </span>
          ) : null}
        </div>
      </div>

      <div className="task-actions">
        <button type="button" className="icon-btn" title="编辑" onClick={() => onEdit(task)}>
          编辑
        </button>
        <button type="button" className="icon-btn danger" title="删除" onClick={() => onDelete(task)}>
          删除
        </button>
      </div>
    </div>
  );
}
