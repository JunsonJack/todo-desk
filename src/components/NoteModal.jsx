import React, { useEffect, useMemo, useState } from 'react';
import SettingsSelect from './SettingsSelect.jsx';

const CATEGORY_COLORS = [
  '#30D158',
  '#0A84FF',
  '#FF9F0A',
  '#BF5AF2',
  '#FF453A',
  '#64D2FF',
  '#8E8E93',
];

const EMPTY = { title: '', content: '', category_id: '', tags: '' };

export default function NoteModal({ open, note, categories, defaultCategoryId, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [creatingCategoryId, setCreatingCategoryId] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);

  useEffect(() => {
    if (!open) return;
    setError('');
    setCreatingCategoryId(null);
    setNewCategoryName('');
    if (note) {
      setForm({
        title: note.title || '',
        content: note.content || '',
        category_id: note.category_id != null ? String(note.category_id) : '',
        tags: note.tags || '',
      });
    } else {
      setForm({
        ...EMPTY,
        category_id: defaultCategoryId != null ? String(defaultCategoryId) : '',
      });
    }
  }, [open, note, defaultCategoryId]);

  const categoryOptions = useMemo(() => ([
    { id: '', label: '未分类' },
    ...categories.map((c) => ({
      id: String(c.id),
      label: c.name,
      color: c.color,
    })),
    { id: 'new', label: '+ 新建分类…' },
  ]), [categories]);

  if (!open) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const categoryValue = creatingCategoryId === 'new' ? 'new' : (form.category_id || '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('请输入标题');
      return;
    }
    try {
      let categoryId = form.category_id ? Number(form.category_id) : null;
      if (creatingCategoryId === 'new') {
        if (!newCategoryName.trim()) {
          setError('请输入新分类名称');
          return;
        }
        const created = await window.api.noteCategories.create({
          name: newCategoryName.trim(),
          color: newCategoryColor,
        });
        categoryId = created.id;
      }
      await onSubmit({
        title: form.title.trim(),
        content: form.content,
        tags: form.tags.trim(),
        category_id: categoryId,
      }, note);
      onClose();
    } catch (err) {
      setError(err?.message || '保存失败');
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        // Only close when pressing the backdrop itself, not when clicks bubble from children.
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h2>{note ? '编辑琐事' : '记一条琐事'}</h2>
          <button type="button" className="icon-btn" onClick={onClose}>关闭</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>标题 *</span>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="例如：家里路由器管理页"
              maxLength={120}
            />
          </label>

          <label className="field">
            <span>正文</span>
            <textarea
              value={form.content}
              onChange={(e) => set('content', e.target.value)}
              placeholder="地址、备注、灵感…想记什么写什么"
              rows={6}
              maxLength={8000}
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span>分类</span>
              <SettingsSelect
                ariaLabel="分类"
                className="field-select"
                value={categoryValue}
                options={categoryOptions}
                onChange={(v) => {
                  if (v === 'new') {
                    setCreatingCategoryId('new');
                    setNewCategoryName('');
                    set('category_id', '');
                  } else {
                    setCreatingCategoryId(null);
                    set('category_id', v);
                  }
                }}
              />
            </label>

            <label className="field">
              <span>标签</span>
              <input
                value={form.tags}
                onChange={(e) => set('tags', e.target.value)}
                placeholder="逗号分隔，如：网络, 家"
                maxLength={200}
              />
            </label>
          </div>

          {creatingCategoryId === 'new' ? (
            <div className="field-row">
              <label className="field">
                <span>新分类名称 *</span>
                <input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="分类名"
                  maxLength={20}
                />
              </label>
              <div className="field">
                <span>颜色</span>
                <div className="color-row">
                  {CATEGORY_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`color-dot ${newCategoryColor === c ? 'active' : ''}`}
                      style={{ background: c }}
                      onClick={() => setNewCategoryColor(c)}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {error ? <p className="form-error">{error}</p> : null}

          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>取消</button>
            <button type="submit" className="btn primary">{note ? '保存' : '记下'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
