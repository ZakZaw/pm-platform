import './AuthPage.css';

/**
 * Shared shell for the logged-out screens (sign in, register, accept invite):
 * brand mark on the canvas, one centred borderless card, optional footer.
 */
export function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="auth-page">
      <div className="auth-page__inner">
        <div className="auth-brand" aria-label="PMO Platform">
          <span className="auth-brand__mark" aria-hidden="true">
            <span>P</span>
          </span>
          <span className="auth-brand__name">PMO Platform</span>
        </div>

        <div className="card auth-page__card">
          {(title || subtitle) && (
            <header className="auth-page__head">
              {title && <h1 className="auth-page__title">{title}</h1>}
              {subtitle && <p className="auth-page__subtitle">{subtitle}</p>}
            </header>
          )}
          {children}
        </div>

        {footer && <p className="auth-page__footer">{footer}</p>}
      </div>
    </div>
  );
}
