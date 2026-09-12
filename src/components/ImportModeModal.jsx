import React from 'react';

export default function ImportModeModal({
  open,
  onCancel,
  onMerge,
  onReplace,
  fileName = '',
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
        className="modal-card confirm-card import-mode-card"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="选择导入方式"
      >
        <div className="confirm-icon-wrap">
          <span className="confirm-icon">⇪</span>
        </div>
        <div className="confirm-body">
          <h3 className="confirm-title">选择导入方式</h3>
          <p className="confirm-message">
            {fileName ? `文件：${fileName}` : '已读取备份文件'}
            <br />
            请选择如何写入当前数据库。
          </p>
        </div>

        <div className="import-mode-list">
          <button type="button" className="import-mode-option" onClick={onMerge}>
            <div className="import-mode-title">增量添加</div>
            <div className="import-mode-desc">
              保留现有数据；只追加备份里新出现的记录（同 ID / 同名跳过）
            </div>
          </button>
          <button type="button" className="import-mode-option danger" onClick={onReplace}>
            <div className="import-mode-title">全量覆盖</div>
            <div className="import-mode-desc">
              清空当前全部任务、项目、紧急程度与琐事后，完全用备份内容替换
            </div>
          </button>
        </div>

        <div className="confirm-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
