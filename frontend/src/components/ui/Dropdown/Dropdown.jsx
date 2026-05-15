import { cloneElement, createContext, useContext, useEffect, useRef, useState } from 'react';
import './Dropdown.css';

const MenuContext = createContext(() => {});

/**
 * Minimal click-to-open menu. The trigger child receives an onClick handler
 * via cloneElement; render whatever you want inside.
 *
 *   <Dropdown trigger={<button>Open</button>}>
 *     <Dropdown.Item onSelect={...}>One</Dropdown.Item>
 *     <Dropdown.Divider />
 *     <Dropdown.Section>Group</Dropdown.Section>
 *     <Dropdown.Item onSelect={...} danger>Delete</Dropdown.Item>
 *   </Dropdown>
 */
export function Dropdown({ trigger, children, align = 'start', className = '' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const triggerWithHandler = cloneElement(trigger, {
    onClick: (e) => {
      trigger.props.onClick?.(e);
      if (!e.defaultPrevented) setOpen((v) => !v);
    },
    'aria-haspopup': 'menu',
    'aria-expanded': open,
  });

  return (
    <div className={['dropdown', className].filter(Boolean).join(' ')} ref={rootRef}>
      {triggerWithHandler}
      {open && (
        <div className={['menu', `menu-align-${align}`].join(' ')} role="menu">
          <MenuContext.Provider value={() => setOpen(false)}>{children}</MenuContext.Provider>
        </div>
      )}
    </div>
  );
}

function Item({ children, onSelect, disabled, danger, icon, kbd }) {
  const close = useContext(MenuContext);
  return (
    <button
      type="button"
      role="menuitem"
      className={['menu-item', danger ? 'menu-item-danger' : ''].filter(Boolean).join(' ')}
      disabled={disabled}
      onClick={(e) => {
        if (disabled) return;
        onSelect?.(e);
        close();
      }}
    >
      {icon && <span className="menu-item__icon">{icon}</span>}
      <span className="menu-item__label">{children}</span>
      {kbd && <span className="menu-item__kbd">{kbd}</span>}
    </button>
  );
}

function Divider() {
  return <div className="menu-divider" role="separator" />;
}

function Section({ children }) {
  return <div className="menu-section">{children}</div>;
}

Dropdown.Item = Item;
Dropdown.Divider = Divider;
Dropdown.Section = Section;
