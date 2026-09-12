import React, { useEffect, useState } from 'react';

const COLORS = [
  '#30D158',
  '#0A84FF',
  '#FF9F0A',
  '#BF5AF2',
  '#FF453A',
  '#64D2FF',
  '#8E8E93',
];

const EMPTY = { name: '', color: COLORS[1] };

export default function CategoryModal({ open, onClose, onSubmit, onDelete }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(EMPTY);
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('请输入分类名称');
      return;
    }
    try {
      await onSubmit({ name: form.name.trim(), color: form.color });
      setForm(EMPTY);
      onClose();
    } catch (err) {
      setError(err?.message || '保存失败');
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div className="modal-card small" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="modal-header">
          <h2>新建琐事分类</h2>
          <button type="button" className="icon-btn" onClick={onClose}>关闭</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>名称 *</span>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="例如：旅行计划"
              maxLength={20}
            />
          </label>
          <div className="field">
            <span>颜色</span>
            <div className="color-row">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-dot ${form.color === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>取消</button>
            <button type="submit" className="btn primary">添加分类</button>
          </div>
        </form>
      </div>
    </div>
  );
}
