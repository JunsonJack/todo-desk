import React, { useEffect, useState } from 'react';

const COLORS = ['#6C8EFF', '#F0A45D', '#5BB89A', '#E56B8A', '#9B7BFF', '#4EC4CF', '#C9A227'];

export default function ProjectModal({ open, project, onClose, onSubmit, onDelete }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setName(project?.name || '');
    setColor(project?.color || COLORS[0]);
  }, [open, project]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('请输入项目名称');
      return;
    }
    try {
      await onSubmit({ name: name.trim(), color }, project);
      onClose();
    } catch (err) {
      setError(err?.message || '保存失败');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card small"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h2>{project ? '编辑项目' : '新建项目'}</h2>
          <button type="button" className="icon-btn" onClick={onClose}>关闭</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>项目名称 *</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：工作 / 学习 / 旅行"
              maxLength={40}
            />
          </label>

          <label className="field">
            <span>颜色</span>
            <div className="color-row">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-dot ${color === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={c}
                />
              ))}
            </div>
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <div className="modal-actions">
            {project ? (
              <button
                type="button"
                className="btn danger"
                onClick={async () => {
                  if (window.confirm('删除该项目？项目下任务会变为「未分组」。')) {
                    await onDelete(project);
                    onClose();
                  }
                }}
              >
                删除项目
              </button>
            ) : (
              <span />
            )}
            <div className="modal-actions-right">
              <button type="button" className="btn ghost" onClick={onClose}>取消</button>
              <button type="submit" className="btn primary">保存</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
