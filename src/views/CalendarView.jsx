import React, { useMemo, useState } from 'react';
import TaskCard from '../components/TaskCard.jsx';
import { EmptyState } from './ListView.jsx';
import {
  formatDateCN,
  monthMatrix,
  sortByTasks,
  todayStr,
} from '../utils/dates.js';

const WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export default function CalendarView({
  tasks,
  priorities = [],
  priorityMap = null,
  onCreate,
  onEdit,
  onToggleDone,
  onDelete,
}) {
  const today = todayStr();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selected, setSelected] = useState(today);

  const weeks = useMemo(
    () => monthMatrix(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  );

  const byDate = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      if (!t.due_date) return;
      if (!map[t.due_date]) map[t.due_date] = [];
      map[t.due_date].push(t);
    });
    Object.keys(map).forEach((k) => {
      map[k] = sortByTasks(map[k], priorityMap);
    });
    return map;
  }, [tasks, priorityMap]);

  const selectedTasks = byDate[selected] || [];
  const selectedOpen = selectedTasks.filter((t) => t.status !== 'done').length;
  const selectedDone = selectedTasks.length - selectedOpen;

  const shiftMonth = (delta) => {
    setCursor((c) => {
      const next = new Date(c.year, c.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const goToday = () => {
    const d = new Date();
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelected(today);
  };

  return (
    <section className="view calendar-view">
      <header className="view-header">
        <div>
          <h1>日历</h1>
          <p className="muted">选中日期，右侧查看与安排当天任务</p>
        </div>
        <button type="button" className="btn primary" onClick={() => onCreate({ due_date: selected })}>
          + 新建任务
        </button>
      </header>

      <div className="calendar-layout">
        <div className="calendar-panel">
          <div className="calendar-toolbar">
            <div className="cal-nav-group">
              <button
                type="button"
                className="cal-nav-btn"
                title="上一月"
                onClick={() => shiftMonth(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                className="cal-nav-btn"
                title="下一月"
                onClick={() => shiftMonth(1)}
              >
                ›
              </button>
              <div className="cal-title-block">
                <div className="cal-title-month">{cursor.month + 1}月</div>
                <div className="cal-title-year">{cursor.year}</div>
              </div>
            </div>
            <button type="button" className="btn ghost mini" onClick={goToday}>
              今天
            </button>
          </div>

          <div className="calendar-grid head">
            {WEEK_LABELS.map((w) => (
              <div key={w} className="cal-cell head">{w}</div>
            ))}
          </div>

          {weeks.map((week, wi) => (
            <div className="calendar-grid" key={wi}>
              {week.map((cell) => {
                const list = byDate[cell.date] || [];
                const openCount = list.filter((t) => t.status !== 'done').length;
                const doneCount = list.length - openCount;
                const isSelected = cell.date === selected;
                const dots = list
                  .filter((t) => t.status !== 'done')
                  .slice(0, 4)
                  .map((t) => priorityMap?.[t.priority]?.color || t.priority_color || '#0A84FF');
                const more = Math.max(openCount - dots.length, 0);

                return (
                  <button
                    key={cell.date}
                    type="button"
                    className={[
                      'cal-cell',
                      cell.inMonth ? '' : 'out',
                      cell.isToday ? 'today' : '',
                      isSelected ? 'selected' : '',
                    ].join(' ')}
                    onClick={() => setSelected(cell.date)}
                  >
                    <div className="cal-cell-top">
                      <span className={`cal-day ${cell.isToday ? 'is-today-num' : ''}`}>
                        {cell.day}
                      </span>
                      {doneCount > 0 && openCount === 0 ? (
                        <span className="cal-done-mark" aria-label="全部完成">✓</span>
                      ) : null}
                    </div>
                    {list.length > 0 ? (
                      <div className="cal-cell-bottom">
                        <div className="cal-dots" aria-hidden="true">
                          {dots.map((color, i) => (
                            <span key={`${cell.date}-${i}`} className="cal-dot" style={{ background: color }} />
                          ))}
                          {more > 0 ? <span className="cal-more">+{more}</span> : null}
                        </div>
                        {openCount > 0 ? (
                          <span className="cal-count-chip">{openCount}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <aside className="day-panel">
          <div className="day-panel-head">
            <div>
              <div className="day-panel-kicker">选中日期</div>
              <h2>{formatDateCN(selected)}</h2>
            </div>
            <div className="day-panel-actions">
              {selectedTasks.length > 0 ? (
                <span className="settings-badge">
                  {selectedDone}/{selectedTasks.length}
                </span>
              ) : null}
              <button
                type="button"
                className="btn primary mini"
                onClick={() => onCreate({ due_date: selected })}
              >
                + 添加
              </button>
            </div>
          </div>

          <div className="task-list">
            {selectedTasks.length === 0 ? (
              <EmptyState
                title="这一天没有任务"
                desc="点右上角「添加」或左侧日期即可安排。"
                action={(
                  <button type="button" className="btn primary" onClick={() => onCreate({ due_date: selected })}>
                    安排到这一天
                  </button>
                )}
              />
            ) : (
              selectedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  priorityMap={priorityMap}
                  onEdit={onEdit}
                  onToggleDone={onToggleDone}
                  onDelete={onDelete}
                  showDate={false}
                />
              ))
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
