import React, { useEffect, useMemo, useState } from 'react';
import { EmptyState } from './ListView.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { formatDateCN } from '../utils/dates.js';

const FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'pinned', label: '置顶' },
];

function formatNoteTime(iso) {
  if (!iso) return '';
  // sqlite localtime like 2026-09-12 10:00:00
  const s = String(iso).replace('T', ' ').slice(0, 16);
  return s;
}

export default function NotesView({
  notes,
  categories,
  noteStats,
  onCreate,
  onEdit,
  onPin,
  onArchive,
  onDelete,
  onCreateCategory,
  onRefresh,
}) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState('list'); // list | detail
  const [showArchived, setShowArchived] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: '',
    message: '',
    confirmText: '确定',
    danger: true,
    onConfirm: null,
  });

  const openConfirm = (options) => {
    setConfirmState({
      open: true,
      title: options.title || '确认操作',
      message: options.message || '',
      confirmText: options.confirmText || '确定',
      danger: options.danger !== false,
      onConfirm: options.onConfirm,
    });
  };

  const closeConfirm = () => {
    setConfirmState((s) => ({ ...s, open: false, onConfirm: null }));
  };

  const active = useMemo(
    () => notes.find((n) => n.id === selectedId) || null,
    [notes, selectedId],
  );

  const filtered = useMemo(() => {
    let list = notes;
    if (activeFilter === 'pinned') {
      list = list.filter((n) => n.pinned);
    } else if (activeFilter === 'none') {
      list = list.filter((n) => n.category_id == null);
    } else if (activeFilter !== 'all') {
      list = list.filter((n) => String(n.category_id) === String(activeFilter));
    }
    if (keyword.trim()) {
      const q = keyword.trim().toLowerCase();
      list = list.filter((n) => `${n.title} ${n.content} ${n.tags || ''}`.toLowerCase().includes(q));
    }
    return list;
  }, [notes, activeFilter, keyword]);

  const openNote = (note) => {
    setSelectedId(note.id);
    setMode('detail');
  };

  const backToList = () => {
    setMode('list');
    setCopied(false);
  };

  const handleArchive = (note, stayInList = false) => {
    if (note.archived) {
      onArchive(note, false).then(() => {
        if (!stayInList) {
          setSelectedId(null);
          setMode('list');
        }
      });
      return;
    }
    openConfirm({
      title: '归档琐事',
      message: `归档「${note.title}」？可在「已归档」中找回。`,
      confirmText: '归档',
      danger: false,
      onConfirm: async () => {
        await onArchive(note, true);
        if (!stayInList) {
          setSelectedId(null);
          setMode('list');
        }
        closeConfirm();
      },
    });
  };

  const requestDeleteNote = (note, stayInList = false) => {
    openConfirm({
      title: '删除琐事',
      message: `确定删除「${note.title}」？此操作无法撤销。`,
      confirmText: '删除',
      danger: true,
      onConfirm: async () => {
        await onDelete(note);
        if (!stayInList) {
          setSelectedId(null);
          setMode('list');
        }
        closeConfirm();
      },
    });
  };

  const handleCopy = async (note) => {
    try {
      await navigator.clipboard.writeText(note.content || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  };

  return (
    <section className="view notes-view">
      <header className="view-header">
        <div>
          <h1>琐事</h1>
          <p className="muted">
            {noteStats
              ? `共 ${noteStats.total} 条 · 置顶 ${noteStats.pinned} · 已归档 ${noteStats.archived}`
              : '备忘、灵感、资料，长期记住的都在这里'}
          </p>
        </div>
        <button type="button" className="btn primary" onClick={() => onCreate()}>
          + 记一条
        </button>
      </header>

      <div className="notes-layout">
        <aside className="notes-sidebar">
          <div className="notes-quick">
            <input
              className="search-input"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索琐事…"
            />
            <button
              type="button"
              className="btn primary mini notes-quick-add"
              onClick={() => {
                const isPreset = FILTERS.some((f) => f.id === activeFilter);
                const isNone = activeFilter === 'none';
                const isCategory = !isPreset && !isNone && activeFilter !== '';
                onCreate({
                  category_id: isCategory ? activeFilter : null,
                });
              }}
            >
              + 记一条
            </button>
          </div>

          <div className="notes-filters">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`notes-filter-item ${activeFilter === f.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveFilter(f.id);
                  setShowArchived(false);
                  setMode('list');
                }}
              >
                <span>{f.label}</span>
                <span className="notes-count">
                  {f.id === 'all' ? (noteStats?.total ?? 0) : (noteStats?.pinned ?? 0)}
                </span>
              </button>
            ))}
          </div>

          <div className="notes-section-label">
            <span>分类</span>
            <button type="button" className="link-btn" onClick={onCreateCategory}>
              管理
            </button>
          </div>

          <div className="notes-filters">
            <button
              type="button"
              className={`notes-filter-item ${activeFilter === 'none' ? 'active' : ''}`}
              onClick={() => {
                setActiveFilter('none');
                setShowArchived(false);
                setMode('list');
              }}
            >
              <span className="notes-filter-label">
                <span className="select-dot select-dot-empty" />
                未分类
              </span>
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`notes-filter-item ${String(activeFilter) === String(c.id) ? 'active' : ''}`}
                onClick={() => {
                  setActiveFilter(String(c.id));
                  setShowArchived(false);
                  setMode('list');
                }}
              >
                <span className="notes-filter-label">
                  <span className="select-dot" style={{ background: c.color }} />
                  {c.name}
                </span>
                <span className="notes-count">{c.note_count ?? 0}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`notes-filter-item notes-archived ${showArchived ? 'active' : ''}`}
            onClick={async () => {
              const next = !showArchived;
              setShowArchived(next);
              setMode('list');
              setActiveFilter('all');
              await onRefresh?.({ archived: next });
            }}
          >
            <span>{showArchived ? '返回未归档' : '已归档'}</span>
            <span className="notes-count">{noteStats?.archived ?? 0}</span>
          </button>
        </aside>

        <div className="notes-main">
          {mode === 'detail' && active ? (
            <article className="note-detail">
              <div className="note-detail-bar">
                <button type="button" className="link-btn" onClick={backToList}>
                  ← 返回列表
                </button>
                <div className="note-detail-actions">
                  <button type="button" className="btn ghost mini" onClick={() => handleCopy(active)}>
                    {copied ? '已复制' : '复制内容'}
                  </button>
                  <button type="button" className="btn ghost mini" onClick={() => onPin(active)}>
                    {active.pinned ? '取消置顶' : '置顶'}
                  </button>
                  <button type="button" className="btn ghost mini" onClick={() => handleArchive(active)}>
                    {active.archived ? '取消归档' : '归档'}
                  </button>
                  <button type="button" className="btn ghost mini" onClick={() => onEdit(active)}>
                    编辑
                  </button>
                  <button
                    type="button"
                    className="btn danger mini"
                    onClick={() => requestDeleteNote(active)}
                  >
                    删除
                  </button>
                </div>
              </div>

              <h2 className="note-detail-title">{active.title}</h2>
              <div className="note-detail-meta">
                {active.category_name ? (
                  <span className="project-chip" style={{ '--chip-color': active.category_color || '#0A84FF' }}>
                    {active.category_name}
                  </span>
                ) : (
                  <span className="project-chip muted">未分类</span>
                )}
                {active.tags ? (
                  <span className="due-chip">{active.tags}</span>
                ) : null}
                <span className="due-chip">更新 {formatNoteTime(active.updated_at)}</span>
                {active.pinned ? <span className="due-chip">已置顶</span> : null}
              </div>
              <pre className="note-detail-body">{active.content || '（无正文）'}</pre>
            </article>
          ) : (
            <div className="notes-list">
              {filtered.length === 0 ? (
                <EmptyState
                  title={keyword ? '没有匹配的琐事' : '这里还没有琐事'}
                  desc="记下地址、灵感、资料，以后随时翻。"
                  action={(
                    <button type="button" className="btn primary" onClick={() => onCreate()}>
                      记第一条
                    </button>
                  )}
                />
              ) : (
                filtered.map((note) => (
                  <div
                    key={note.id}
                    className={`note-card ${note.pinned ? 'is-pinned' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => openNote(note)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openNote(note);
                      }
                    }}
                  >
                    <div className="note-card-top">
                      <span className="note-card-title">{note.title}</span>
                      <div className="note-card-actions">
                        {note.pinned ? <span className="note-pin">★</span> : null}
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(note);
                          }}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchive(note, true);
                          }}
                        >
                          {note.archived ? '取消归档' : '归档'}
                        </button>
                        <button
                          type="button"
                          className="icon-btn danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            requestDeleteNote(note, true);
                          }}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                    {note.content ? (
                      <p className="note-card-preview">{note.content}</p>
                    ) : null}
                    <div className="note-card-meta">
                      {note.category_name ? (
                        <span className="notes-cat">
                          <span className="select-dot" style={{ background: note.category_color || '#0A84FF' }} />
                          {note.category_name}
                        </span>
                      ) : (
                        <span className="notes-cat muted">未分类</span>
                      )}
                      <span>{formatNoteTime(note.updated_at)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        danger={confirmState.danger}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />
    </section>
  );
}
