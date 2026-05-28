import { useEffect, useRef, useState } from 'react';
import { CornerDownLeft, Send, Smile } from 'lucide-react';
import { Button } from '@/components/ui';
import { emojiGlyph, QUICK_EMOJI } from './messageMarkdown';

/**
 * Compose box for a channel or thread. Enter submits; Shift+Enter
 * inserts a newline so multi-line markdown still works. We keep the
 * picker dead simple — a small grid of common shortcodes inserted at
 * the caret. The real emoji-mart picker can swap in later without
 * changing the contract.
 */
export function MessageInput({
  placeholder = 'Send a message…',
  onSubmit,
  disabled = false,
  parent = null, // when set, shows the "Replying to …" hint
  onCancelReply,
  autoFocus = false,
}) {
  const [value, setValue] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  async function submit() {
    const body = value.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await onSubmit?.(body);
      setValue('');
      setPickerOpen(false);
      textareaRef.current?.focus();
    } finally {
      setSending(false);
    }
  }

  function insertAtCaret(snippet) {
    const ta = textareaRef.current;
    if (!ta) {
      setValue((v) => v + snippet);
      return;
    }
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const next = value.slice(0, start) + snippet + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      ta.focus();
      const caret = start + snippet.length;
      ta.setSelectionRange(caret, caret);
    });
  }

  return (
    <div className="msg-input">
      {parent && (
        <div className="msg-input-reply-to">
          <CornerDownLeft size={11} aria-hidden="true" />
          Replying to <strong>{parent.authorName || parent.authorEmail}</strong>
          <button type="button" className="msg-input-reply-cancel" onClick={onCancelReply}>
            Cancel
          </button>
        </div>
      )}
      <div className="msg-input-row">
        <textarea
          ref={textareaRef}
          className="msg-input-text"
          value={value}
          rows={Math.min(8, Math.max(1, value.split('\n').length))}
          placeholder={placeholder}
          disabled={disabled || sending}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
            if (e.key === 'Escape' && pickerOpen) setPickerOpen(false);
          }}
        />
        <div className="msg-input-controls">
          <button
            type="button"
            className="msg-input-emoji-btn"
            onClick={() => setPickerOpen((s) => !s)}
            aria-label="Add emoji"
            title="Add emoji"
            disabled={disabled || sending}
          >
            <Smile size={13} aria-hidden="true" />
          </button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={submit}
            disabled={disabled || sending || !value.trim()}
          >
            <Send size={11} aria-hidden="true" />
            {sending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </div>
      {pickerOpen && (
        <div className="msg-input-picker" role="dialog" aria-label="Pick an emoji">
          {QUICK_EMOJI.map((code) => (
            <button
              key={code}
              type="button"
              className="msg-input-pick"
              title={code}
              onClick={() => {
                insertAtCaret(`${code} `);
                setPickerOpen(false);
              }}
            >
              {emojiGlyph(code)}
            </button>
          ))}
        </div>
      )}
      <p className="msg-input-hint muted">
        Markdown supported · <code>:tada:</code> for emoji · <code>[[task:KEY]]</code> embeds a task
      </p>
    </div>
  );
}
