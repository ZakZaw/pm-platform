import './AuthPage.css';

/**
 * Shared shell for the logged-out screens (sign in, register, accept invite):
 * brand mark on the canvas, one centred borderless card, optional footer.
 */
export function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="auth-page">
      <div className="auth-page-inner">
        <div className="auth-brand" aria-label="PMO Platform">
          <span className="auth-brand-mark" aria-hidden="true">
            <span>P</span>
          </span>
          <span className="auth-brand-name">PMO Platform</span>
        </div>

        <div className="card auth-page-card">
          {(title || subtitle) && (
            <header className="auth-page-head">
              {title && <h1 className="auth-page-title">{title}</h1>}
              {subtitle && <p className="auth-page-subtitle">{subtitle}</p>}
            </header>
          )}
          {children}
        </div>

        {footer && <p className="auth-page-footer">{footer}</p>}
      </div>
    </div>
  );
}
