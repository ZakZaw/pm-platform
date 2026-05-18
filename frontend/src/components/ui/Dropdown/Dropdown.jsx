import {
  cloneElement,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
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
 *
 * The menu auto-flips horizontally and vertically when it would overflow
 * the viewport — so it stays inside narrow containers like the task
 * detail drawer.
 */
export function Dropdown({ trigger, children, align = 'start', className = '' }) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({ align, side: 'bottom' });
  const rootRef = useRef(null);
  const menuRef = useRef(null);

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

  // Reset placement to the requested align/side every time the menu opens —
  // otherwise a previous flip can stick when the trigger moves back into
  // a position where the original alignment fits.
  useLayoutEffect(() => {
    if (!open) {
      setPlacement({ align, side: 'bottom' });
      return;
    }
    const menu = menuRef.current;
    const root = rootRef.current;
    if (!menu || !root) return;
    const triggerRect = root.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;

    // Horizontal: if start-aligned and overflowing the right edge, try end.
    // If end-aligned and overflowing the left edge, try start. We compare
    // against the trigger's left/right so the menu hugs the right corner.
    let nextAlign = align;
    if (align === 'start' && triggerRect.left + menuRect.width > vw - margin) {
      nextAlign = 'end';
    } else if (align === 'end' && triggerRect.right - menuRect.width < margin) {
      nextAlign = 'start';
    }

    // Vertical: if bottom-side overflows, try top. The menu's max-height
    // CSS caps its size, so once flipped it always fits.
    let nextSide = 'bottom';
    if (triggerRect.bottom + menuRect.height + margin > vh) {
      // Only flip up if there's actually room above.
      if (triggerRect.top - menuRect.height - margin > 0) {
        nextSide = 'top';
      }
    }
    if (nextAlign !== placement.align || nextSide !== placement.side) {
      setPlacement({ align: nextAlign, side: nextSide });
    }
  }, [open, align, children, placement.align, placement.side]);

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
        <div
          ref={menuRef}
          className={[
            'menu',
            `menu-align-${placement.align}`,
            `menu-side-${placement.side}`,
          ].join(' ')}
          role="menu"
        >
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
