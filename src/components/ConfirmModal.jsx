import React from 'react';

export default function ConfirmModal({
  open,
  title = '确认操作',
  message = '',
  confirmText = '确定',
  cancelText = '取消',
  danger = true,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div
      className="modal-backdrop confirm-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel?.();
      }}
      role="presentation"
    >
      <div
        className="modal-card confirm-card"
        onMouseDown={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="confirm-icon-wrap">
          <span className={`confirm-icon ${danger ? 'danger' : ''}`}>!</span>
        </div>
        <div className="confirm-body">
          <h3 className="confirm-title">{title}</h3>
          <p className="confirm-message">{message}</p>
        </div>
        <div className="confirm-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'danger-solid' : 'primary'}`}
            autoFocus
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
