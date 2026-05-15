import { useEffect, useRef, useState } from 'react';
import { Avatar, Button } from '@/components/ui';
import { commentsApi } from '@/api/comments.api';
import './CommentInput.css';

const MENTION_TOKEN_RE = /@\[([^\]]+)\]\(([0-9a-f-]{36})\)/g;

/**
 * Comment composer with an @-mention picker. Mentions are stored in the
 * body as "@[Display Name](uuid)" tokens; the textarea renders the raw
 * tokens (we don't try to make this a contenteditable). When the user
 * types "@" followed by characters, a dropdown of matching org members
 * appears. Picking one replaces the trigger with the canonical token.
 */
export function CommentInput({
  projectId,
  initialValue = '',
  onSubmit,
  onCancel,
  submitLabel = 'Comment',
  autoFocus = false,
}) {
  const [value, setValue] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState([]);
  const [allUsers, setAllUsers] = useState(null);
  const [query, setQuery] = useState(null); // null when no active trigger
  const [highlight, setHighlight] = useState(0);
  const textareaRef = useRef(null);
  const triggerStart = useRef(null);

  useEffect(() => {
    if (autoFocus) {
      textareaRef.current?.focus();
    }
  }, [autoFocus]);

  // Fetch mentionable users once per project; we filter client-side per
  // keystroke to keep the dropdown snappy.
  useEffect(() => {
    if (!projectId || allUsers !== null) return;
    let cancelled = false;
    commentsApi
      .mentionableUsers(projectId)
      .then((data) => {
        if (!cancelled) setAllUsers(data);
      })
      .catch(() => {
        if (!cancelled) setAllUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, allUsers]);

  function refreshDropdown(q) {
    if (!allUsers) return;
    const lower = q.toLowerCase();
    setUsers(
      allUsers
        .filter(
          (u) =>
            u.fullName.toLowerCase().includes(lower) ||
            u.email.toLowerCase().includes(lower),
        )
        .slice(0, 6),
    );
    setHighlight(0);
  }

  function handleChange(e) {
    const next = e.target.value;
    setValue(next);
    const caret = e.target.selectionStart ?? next.length;
    detectTrigger(next, caret);
  }

  function detectTrigger(text, caret) {
    // Walk backwards from the caret to find a '@' that starts a token,
    // stopping at whitespace or another '@' or '('. If the slice between
    // '@' and caret matches /^[\w .-]*$/, it's an active trigger.
    let i = caret - 1;
    while (i >= 0) {
      const ch = text[i];
      if (ch === '@') {
        const before = i === 0 ? ' ' : text[i - 1];
        if (before === ' ' || before === '\n' || before === '\t' || i === 0) {
          const q = text.slice(i + 1, caret);
          if (/^[\w .-]*$/.test(q)) {
            triggerStart.current = i;
            setQuery(q);
            refreshDropdown(q);
            return;
          }
        }
        break;
      }
      if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '(' || ch === ')') break;
      i -= 1;
    }
    triggerStart.current = null;
    setQuery(null);
  }

  function pickMention(user) {
    const start = triggerStart.current;
    if (start == null) return;
    const before = value.slice(0, start);
    const after = value.slice(textareaRef.current?.selectionStart ?? value.length);
    const token = `@[${user.fullName}](${user.id}) `;
    const next = `${before}${token}${after}`;
    setValue(next);
    setQuery(null);
    triggerStart.current = null;
    setTimeout(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        const pos = before.length + token.length;
        el.setSelectionRange(pos, pos);
      }
    }, 0);
  }

  function handleKeyDown(e) {
    if (query !== null && users.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => Math.min(users.length - 1, h + 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pickMention(users[highlight]);
        return;
      }
      if (e.key === 'Escape') {
        setQuery(null);
        triggerStart.current = null;
        return;
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (value.trim().length === 0) return;
    const mentions = [];
    for (const m of value.matchAll(MENTION_TOKEN_RE)) {
      if (!mentions.includes(m[2])) mentions.push(m[2]);
    }
    setSubmitting(true);
    try {
      await onSubmit({ bodyMd: value, mentionedUserIds: mentions });
      setValue('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="comment-input" onSubmit={handleSubmit}>
      <div className="comment-input__wrap">
        <textarea
          ref={textareaRef}
          className="comment-input__textarea"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment… type @ to mention"
          rows={3}
        />
        {query !== null && users.length > 0 && (
          <ul className="comment-input__menu" role="listbox">
            {users.map((u, i) => (
              <li
                key={u.id}
                role="option"
                aria-selected={i === highlight}
                className={['comment-input__menu-item', i === highlight ? 'is-active' : '']
                  .filter(Boolean)
                  .join(' ')}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickMention(u);
                }}
              >
                <Avatar name={u.fullName} src={u.avatarUrl} size="xs" />
                <div className="comment-input__menu-text">
                  <div className="comment-input__menu-name">{u.fullName}</div>
                  <div className="comment-input__menu-email">{u.email}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="comment-input__actions">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" disabled={submitting || value.trim().length === 0}>
          {submitting ? 'Posting…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
