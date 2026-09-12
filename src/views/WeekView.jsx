import React, { useMemo, useState } from 'react';
import { EmptyState } from './ListView.jsx';
import { STATUS_META, getPriorityMeta, isOverdue } from '../utils/dates.js';
import {
  formatDateCN,
  sortByTasks,
  todayStr,
  weekDays,
} from '../utils/dates.js';

const WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function WeekTaskRow({ task, priorityMap, onEdit, onToggleDone, onDelete }) {
  const done = task.status === 'done';
  const priority = getPriorityMeta(task, priorityMap);
  const overdue = isOverdue(task);
  const status = STATUS_META[task.status];

  return (
    <div
      className={[
        'week-task',
        done ? 'is-done' : '',
        overdue ? 'is-overdue' : '',
      ].join(' ')}
      title={`${task.title}${task.project_name ? ` · ${task.project_name}` : ''}`}
    >
      <span
        className="week-task-stripe"
        style={{ background: priority.color }}
      />
      <button
        type="button"
        className="week-task-check"
        aria-label={done ? '重新打开' : '标记完成'}
        onClick={() => onToggleDone(task)}
      >
        {done ? '✓' : ''}
      </button>
      <button
        type="button"
        className="week-task-title"
        onClick={() => onEdit(task)}
      >
        <span className="week-task-title-text">{task.title}</span>
      </button>
      <div className="week-task-meta">
        {task.project_name ? (
          <span className="week-task-project" title={task.project_name}>
            {task.project_name.slice(0, 2)}
          </span>
        ) : null}
        <span className="sr-only">{status.label}</span>
      </div>
      <div className="week-task-actions">
        <button type="button" className="week-task-act" onClick={() => onEdit(task)} title="编辑">
          编
        </button>
        <button type="button" className="week-task-act danger" onClick={() => onDelete(task)} title="删除">
          删
        </button>
      </div>
    </div>
  );
}

export default function WeekView({
  tasks,
  priorityMap = null,
  onCreate,
  onEdit,
  onToggleDone,
  onDelete,
}) {
  const today = todayStr();
  const days = weekDays(today);
  const start = days[0];
  const end = days[6];
  const [showDone, setShowDone] = useState({});

  const weekTasks = useMemo(() => (
    tasks.filter((t) => t.due_date && t.due_date >= start && t.due_date <= end)
  ), [tasks, start, end]);

  const grouped = useMemo(() => {
    const map = Object.fromEntries(days.map((d) => [d, []]));
    weekTasks.forEach((t) => {
      if (map[t.due_date]) map[t.due_date].push(t);
    });
    Object.keys(map).forEach((k) => {
      map[k] = sortByTasks(map[k], priorityMap);
    });
    return map;
  }, [weekTasks, days, priorityMap]);

  const total = weekTasks.length;
  const done = weekTasks.filter((t) => t.status === 'done').length;
  const weekProgress = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <section className="view week-view">
      <header className="view-header">
        <div>
          <h1>每周</h1>
          <p className="muted">
            {formatDateCN(start)} — {formatDateCN(end)} · 完成 {done}/{total} · {weekProgress}%
          </p>
        </div>
        <button
          type="button"
          className="btn create"
          onClick={() => onCreate({ due_date: today })}
        >
          <span className="btn-plus" aria-hidden="true">+</span>
          新建任务
        </button>
      </header>

      <div className="week-summary">
        <div className="week-summary-track">
          <div className="week-summary-fill" style={{ width: `${weekProgress}%` }} />
        </div>
        <span className="week-summary-label">{done}/{total} 已完成</span>
      </div>

      <div className="week-grid">
        {days.map((day, idx) => {
          const list = grouped[day] || [];
          const isToday = day === today;
          const openCount = list.filter((t) => t.status !== 'done').length;
          const doneCount = list.length - openCount;
          const dayProgress = list.length === 0
            ? 0
            : Math.round((doneCount / list.length) * 100);
          const isOpen = showDone[day] ?? openCount < 8;
          const openTasks = list.filter((t) => t.status !== 'done');
          const doneTasks = list.filter((t) => t.status === 'done');

          return (
            <div key={day} className={`week-col ${isToday ? 'is-today' : ''}`}>
              <div className="week-col-head">
                <div className="week-col-head-top">
                  <div>
                    <span className="week-col-label">{WEEK_LABELS[idx]}</span>
                    <span className="week-col-date">{day.slice(5).replace('-', '/')}</span>
                  </div>
                  {isToday ? <span className="today-badge">今天</span> : null}
                  <button
                    type="button"
                    className="week-add-btn"
                    title="添加到这一天"
                    onClick={() => onCreate({ due_date: day })}
                  >
                    +
                  </button>
                </div>
                <div className="week-col-stats">
                  <span>{list.length} 项</span>
                  {doneCount > 0 ? <span>· {doneCount} 完成</span> : null}
                </div>
                <div className="week-col-progress">
                  <div className="week-col-progress-fill" style={{ width: `${dayProgress}%` }} />
                </div>
              </div>

              <div className="week-col-body">
                {list.length === 0 ? (
                  <button
                    type="button"
                    className="add-slot"
                    onClick={() => onCreate({ due_date: day })}
                  >
                    + 安排任务
                  </button>
                ) : (
                  <>
                    <div className="week-task-list">
                      {openTasks.map((task) => (
                        <WeekTaskRow
                          key={task.id}
                          task={task}
                          priorityMap={priorityMap}
                          onEdit={onEdit}
                          onToggleDone={onToggleDone}
                          onDelete={onDelete}
                        />
                      ))}
                      {openTasks.length === 0 ? (
                        <div className="week-all-done">今天都完成了</div>
                      ) : null}
                    </div>

                    {doneTasks.length > 0 ? (
                      <div className="week-done-block">
                        <button
                          type="button"
                          className="week-done-toggle"
                          onClick={() => setShowDone((s) => ({ ...s, [day]: !isOpen }))}
                        >
                          <span>{isOpen ? '▾' : '▸'}</span>
                          <span>已完成 {doneTasks.length}</span>
                        </button>
                        {isOpen ? (
                          <div className="week-task-list is-done-list">
                            {doneTasks.map((task) => (
                              <WeekTaskRow
                                key={task.id}
                                task={task}
                                priorityMap={priorityMap}
                                onEdit={onEdit}
                                onToggleDone={onToggleDone}
                                onDelete={onDelete}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      className="week-add-row"
                      onClick={() => onCreate({ due_date: day })}
                    >
                      + 添加任务
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {total === 0 ? (
        <div className="week-empty">
          <EmptyState
            title="这一周还是空的"
            desc="按天点开看板，把计划写进对应日期。"
          />
        </div>
      ) : null}
    </section>
  );
}
