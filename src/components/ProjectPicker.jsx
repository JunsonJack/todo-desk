import React, { useEffect, useMemo, useRef, useState } from 'react';

export default function ProjectPicker({
  projects,
  value,
  onChange,
  onCreateProject,
  onManageProjects,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);

  const selected = useMemo(
    () => projects.find((p) => String(p.id) === String(value)) || null,
    [projects, value],
  );

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, q]);

  const exactExists = projects.some(
    (p) => q.length > 0 && p.name.trim().toLowerCase() === q,
  );
  const canCreate = q.length > 0 && !exactExists;

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (!wrapRef.current?.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const optionCount = filtered.length + (canCreate ? 1 : 0) + 1;

  const commit = (nextValue, nextQuery = '') => {
    onChange(nextValue);
    setQuery(nextQuery);
    setOpen(false);
    setHighlight(0);
  };

  const handleSelectProject = (project) => {
    commit(String(project.id), '');
  };

  const handleCreate = async () => {
    if (!canCreate) return;
    const name = query.trim();
    const created = await onCreateProject({ name });
    if (created?.id != null) {
      commit(String(created.id), '');
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(optionCount - 1, 0)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === 'Enter' && open) {
      e.preventDefault();
      if (highlight < filtered.length) {
        handleSelectProject(filtered[highlight]);
      } else if (canCreate && highlight === filtered.length) {
        handleCreate();
      } else if (highlight === optionCount - 1) {
        commit('', '');
      }
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  // Chip already shows the selection; keep input empty when closed to avoid double text.
  const inputValue = open ? query : '';

  return (
    <div className="project-picker" ref={wrapRef}>
      <div className={`project-picker-shell ${open ? 'is-open' : ''} ${selected ? 'has-value' : ''}`}>
        {selected ? (
          <span className="project-chip">
            <span
              className="project-dot"
              style={{ background: selected.color || '#6C8EFF' }}
            />
            <span className="project-chip-name">{selected.name}</span>
            <button
              type="button"
              className="project-chip-clear"
              title="改为未分组"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit('', '')}
            >
              ×
            </button>
          </span>
        ) : null}

        <input
          className="project-picker-input"
          value={inputValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => {
            setOpen(true);
            setHighlight(0);
            // Start typing from empty query, keep selection visible in dropdown.
            if (selected) setQuery('');
          }}
          onKeyDown={onKeyDown}
          placeholder={selected ? '输入以筛选或新建项目' : '选择项目，或输入名称新建'}
          autoComplete="off"
        />
      </div>

      {open ? (
        <div className="project-picker-menu" role="listbox">
          {filtered.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              className={[
                'project-option',
                highlight === idx ? 'active' : '',
                String(p.id) === String(value) ? 'selected' : '',
              ].join(' ')}
              onMouseEnter={() => setHighlight(idx)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelectProject(p)}
            >
              <span className="project-dot" style={{ background: p.color || '#6C8EFF' }} />
              <span className="project-option-name">{p.name}</span>
              {p.open_count != null ? (
                <span className="project-option-meta">未完成 {p.open_count}</span>
              ) : null}
            </button>
          ))}

          {canCreate ? (
            <button
              type="button"
              className={[
                'project-option',
                'create',
                highlight === filtered.length ? 'active' : '',
              ].join(' ')}
              onMouseEnter={() => setHighlight(filtered.length)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCreate}
            >
              <span className="project-option-icon">+</span>
              <span className="project-option-name">新建项目「{query.trim()}」</span>
            </button>
          ) : null}

          <button
            type="button"
            className={[
              'project-option',
              'none',
              highlight === optionCount - 1 ? 'active' : '',
            ].join(' ')}
            onMouseEnter={() => setHighlight(optionCount - 1)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => commit('', '')}
          >
            <span className="project-dot" style={{ background: '#8b97ad' }} />
            <span className="project-option-name">未分组</span>
          </button>
        </div>
      ) : null}

      <div className="project-picker-foot">
        <button type="button" className="link-btn" onClick={onManageProjects}>
          管理项目
        </button>
      </div>
    </div>
  );
}
