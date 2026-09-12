import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

const CLOSE_MS = 150;

export default function SettingsSelect({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
}) {
  // menuState: 'closed' | 'open' | 'closing'
  const [menuState, setMenuState] = useState('closed');
  const [highlight, setHighlight] = useState(() =>
    Math.max(0, options.findIndex((o) => o.id === value)),
  );
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const selectingRef = useRef(false);
  const closeTimerRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState({});

  const open = menuState === 'open';
  const visible = menuState === 'open' || menuState === 'closing';
  const selected = options.find((o) => o.id === value) || options[0];

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  useEffect(() => () => clearCloseTimer(), []);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) {
        setMenuState('closing');
        clearCloseTimer();
        closeTimerRef.current = setTimeout(() => {
          setMenuState('closed');
          closeTimerRef.current = null;
        }, CLOSE_MS);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuStyle({
      top: rect.height + 8,
      minWidth: Math.max(rect.width, 180),
    });
  }, [open, options.length]);

  const openMenu = () => {
    clearCloseTimer();
    setMenuState('open');
  };

  const closeMenu = () => {
    setMenuState('closing');
    selectingRef.current = false;
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setMenuState('closed');
      closeTimerRef.current = null;
    }, CLOSE_MS);
  };

  const commit = (id) => {
    if (selectingRef.current) return;
    selectingRef.current = true;
    closeMenu();
    try {
      onChange?.(id);
    } finally {
      setTimeout(() => {
        selectingRef.current = false;
      }, 0);
    }
    setHighlight(options.findIndex((o) => o.id === id));
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openMenu();
      setHighlight((h) => {
        const next = e.key === 'ArrowDown' ? h + 1 : h - 1;
        if (next < 0) return options.length - 1;
        if (next >= options.length) return 0;
        return next;
      });
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open && options[highlight]) {
        commit(options[highlight].id);
      } else {
        openMenu();
      }
      return;
    }
    if (e.key === 'Escape') {
      closeMenu();
      triggerRef.current?.focus();
    }
  };

  return (
    <div
      className={`settings-select ${className} ${open ? 'is-open' : ''} ${menuState === 'closing' ? 'is-closing' : ''}`}
      ref={wrapRef}
    >
      <button
        ref={triggerRef}
        type="button"
        className="settings-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => {
          if (selectingRef.current) return;
          if (open) closeMenu();
          else openMenu();
        }}
        onKeyDown={onKeyDown}
      >
        <span className="settings-select-label">
          {selected?.color ? (
            <span className="select-dot" style={{ background: selected.color }} />
          ) : null}
          <span className="settings-select-text">{selected?.label}</span>
        </span>
        <span className="settings-select-chevron" aria-hidden="true">
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
            <path
              d="M1 1.2L5 5L9 1.2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {visible ? (
        <div className="settings-select-menu" role="listbox" style={menuStyle}>
          <div className="settings-select-menu-inner">
            {options.map((opt, idx) => (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={opt.id === value}
                className={`settings-select-option ${idx === highlight ? 'active' : ''} ${opt.id === value ? 'selected' : ''}`}
                onMouseEnter={() => setHighlight(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  commit(opt.id);
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  commit(opt.id);
                }}
              >
                <span className="settings-select-check-slot" aria-hidden="true">
                  {opt.id === value ? (
                    <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                      <path
                        d="M1 5.2L4.2 8.2L11 1.4"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </span>
                {opt.color ? (
                  <span className="select-dot" style={{ background: opt.color }} />
                ) : (
                  <span className="select-dot select-dot-empty" />
                )}
                <span className="settings-select-text">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
