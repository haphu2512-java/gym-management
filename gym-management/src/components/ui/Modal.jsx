
export default function Modal({ isOpen, title, children, onClose, onConfirm, confirmText = 'XÃ¡c nháº­n', cancelText = 'Há»§y' }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>âœ•</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{cancelText}</button>
          {onConfirm && (
            <button className="btn btn-primary" onClick={onConfirm}>{confirmText}</button>
          )}
        </div>
      </div>
    </div>
  );
}

