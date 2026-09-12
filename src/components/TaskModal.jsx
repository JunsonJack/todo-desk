import React, { useEffect, useState } from 'react';
import { STATUS_META } from '../utils/dates.js';
import ProjectPicker from './ProjectPicker.jsx';
import SettingsSelect from './SettingsSelect.jsx';

const emptyForm = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  due_date: '',
  project_id: '',
};

export default function TaskModal({
  open,
  task,
  projects,
  priorities = [],
  defaultDate,
  defaultProjectId,
  defaultPriority = 'medium',
  defaultStatus = 'todo',
  onClose,
  onSubmit,
  onCreateProject,
  onManageProjects,
}) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [pendingProjectId, setPendingProjectId] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError('');
    setPendingProjectId(null);
    if (task) {
      setForm({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'todo',
        priority: task.priority || 'medium',
        due_date: task.due_date || '',
        project_id: task.project_id != null ? String(task.project_id) : '',
      });
    } else {
      const fallbackPriority = priorities[0]?.code || defaultPriority;
      setForm({
        ...emptyForm,
        status: defaultStatus,
        priority: fallbackPriority,
        due_date: defaultDate || '',
        project_id: defaultProjectId != null ? String(defaultProjectId) : '',
      });
    }
  }, [open, task, defaultDate, defaultProjectId, defaultPriority, defaultStatus, priorities]);

  if (!open) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleCreateProject = async ({ name }) => {
    const created = await onCreateProject({ name });
    if (created?.id != null) {
      set('project_id', String(created.id));
      setPendingProjectId(created.id);
    }
    return created;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('请输入任务标题');
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      status: form.status,
      priority: form.priority,
      due_date: form.due_date || null,
      project_id: form.project_id ? Number(form.project_id) : null,
    };

    try {
      await onSubmit(payload, task);
      onClose();
    } catch (err) {
      setError(err?.message || '保存失败');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={task ? '编辑任务' : '新建任务'}
      >
        <div className="modal-header">
          <h2>{task ? '编辑任务' : '新建任务'}</h2>
          <button type="button" className="icon-btn" onClick={onClose}>关闭</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>标题 *</span>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="要做什么？"
              maxLength={120}
            />
          </label>

          <label className="field">
            <span>备注</span>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="可选：补充说明、链接、步骤..."
              rows={3}
              maxLength={2000}
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span>状态</span>
              <SettingsSelect
                ariaLabel="状态"
                className="field-select"
                value={form.status}
                options={Object.entries(STATUS_META).map(([key, meta]) => ({
                  id: key,
                  label: meta.label,
                }))}
                onChange={(v) => set('status', v)}
              />
            </label>

            <label className="field">
              <span>紧急程度</span>
              <SettingsSelect
                ariaLabel="紧急程度"
                className="field-select"
                value={form.priority}
                options={priorities.map((p) => ({
                  id: p.code,
                  label: p.name,
                  color: p.color,
                }))}
                onChange={(v) => set('priority', v)}
              />
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>截止日期</span>
              <input
                type="date"
                value={form.due_date || ''}
                onChange={(e) => set('due_date', e.target.value)}
              />
            </label>

            <div className="field">
              <span>所属项目</span>
              <ProjectPicker
                projects={projects}
                value={form.project_id}
                onChange={(v) => set('project_id', v)}
                onCreateProject={handleCreateProject}
                onManageProjects={onManageProjects}
              />
              {pendingProjectId != null ? (
                <span className="field-hint">已新建并选中该项目</span>
              ) : null}
            </div>
          </div>

          {error ? <p className="form-error">{error}</p> : null}

          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>取消</button>
            <button type="submit" className="btn primary">{task ? '保存修改' : '创建任务'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
