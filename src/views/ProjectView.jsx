import React, { useMemo, useState } from 'react';
import TaskCard from '../components/TaskCard.jsx';
import { EmptyState } from './ListView.jsx';
import { sortByTasks, todayStr } from '../utils/dates.js';

export default function ProjectView({
  tasks,
  projects,
  priorities = [],
  priorityMap = null,
  onCreateTask,
  onCreateProject,
  onEditProject,
  onEdit,
  onToggleDone,
  onDelete,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const today = todayStr();
  const topPriority = priorities[0]?.code || 'urgent';

  const isUngrouped = selectedId === -1;
  const activeProject = isUngrouped
    ? null
    : projects.find((p) => p.id === selectedId) || null;
  const showDetail = isUngrouped || !!activeProject;

  const activeTasks = useMemo(() => {
    if (isUngrouped) {
      return sortByTasks(tasks.filter((t) => t.project_id == null), priorityMap);
    }
    if (!activeProject) return [];
    return sortByTasks(tasks.filter((t) => t.project_id === activeProject.id), priorityMap);
  }, [tasks, activeProject, isUngrouped, priorityMap]);

  const ungrouped = useMemo(
    () => sortByTasks(tasks.filter((t) => t.project_id == null), priorityMap),
    [tasks, priorityMap],
  );

  if (showDetail) {
    const open = activeTasks.filter((t) => t.status !== 'done').length;
    const todayCount = activeTasks.filter((t) => t.due_date === today).length;
    const title = isUngrouped ? '未分组' : activeProject.name;
    const color = isUngrouped ? '#8b97ad' : activeProject.color;

    return (
      <section className="view">
        <header className="view-header">
          <div>
            <button type="button" className="link-btn" onClick={() => setSelectedId(null)}>
              ← 返回项目列表
            </button>
            <h1>
              <span className="project-dot" style={{ background: color }} />
              {title}
            </h1>
            <p className="muted">未完成 {open} · 今日 {todayCount} · 总计 {activeTasks.length}</p>
          </div>
          <div className="header-actions">
            {!isUngrouped ? (
              <button type="button" className="btn ghost" onClick={() => onEditProject(activeProject)}>
                编辑项目
              </button>
            ) : null}
            <button
              type="button"
              className="btn primary"
              onClick={() => onCreateTask(isUngrouped ? {} : { project_id: activeProject.id })}
            >
              + 新建任务
            </button>
          </div>
        </header>

        <div className="task-list">
          {activeTasks.length === 0 ? (
            <EmptyState
              title={isUngrouped ? '没有未分组任务' : '这个项目还没有任务'}
              desc={isUngrouped
                ? '未分配到任何项目的任务会出现在这里。'
                : '把相关待办都归到项目里，方便集中推进。'}
              action={(
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => onCreateTask(isUngrouped ? {} : { project_id: activeProject.id })}
                >
                  新建任务
                </button>
              )}
            />
          ) : (
            activeTasks.map((task) => (
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

  return (
    <section className="view">
      <header className="view-header">
        <div>
          <h1>项目</h1>
          <p className="muted">按项目/场景组织任务，点进卡片查看看板</p>
        </div>
        <button type="button" className="btn primary" onClick={onCreateProject}>
          + 新建项目
        </button>
      </header>

      <div className="project-grid">
        {projects.map((project) => {
          const list = tasks.filter((t) => t.project_id === project.id);
          const open = list.filter((t) => t.status !== 'done').length;
          const done = list.length - open;
          const urgent = list.filter((t) => t.priority === topPriority && t.status !== 'done').length;
          return (
            <button
              key={project.id}
              type="button"
              className="project-card"
              onClick={() => setSelectedId(project.id)}
            >
              <div className="project-card-top">
                <span className="project-dot" style={{ background: project.color }} />
                <span className="project-name">{project.name}</span>
              </div>
              <div className="project-card-stats">
                <div>
                  <strong>{open}</strong>
                  <span>未完成</span>
                </div>
                <div>
                  <strong>{done}</strong>
                  <span>已完成</span>
                </div>
                <div>
                  <strong className={urgent ? 'text-danger' : ''}>{urgent}</strong>
                  <span>紧急</span>
                </div>
              </div>
              <div className="project-card-foot">
                共 {list.length} 项任务
              </div>
            </button>
          );
        })}

        <button
          type="button"
          className="project-card"
          onClick={() => setSelectedId(-1)}
        >
          <div className="project-card-top">
            <span className="project-dot" style={{ background: '#8b97ad' }} />
            <span className="project-name">未分组</span>
          </div>
          <div className="project-card-stats">
            <div>
              <strong>{ungrouped.filter((t) => t.status !== 'done').length}</strong>
              <span>未完成</span>
            </div>
            <div>
              <strong>{ungrouped.filter((t) => t.status === 'done').length}</strong>
              <span>已完成</span>
            </div>
            <div>
              <strong>{ungrouped.length}</strong>
              <span>总计</span>
            </div>
          </div>
          <div className="project-card-foot">
            尚未归入项目的任务
          </div>
        </button>
      </div>
    </section>
  );
}
