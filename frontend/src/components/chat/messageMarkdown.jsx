import { TaskCardEmbed } from './TaskCardEmbed';

/**
 * Tiny inline markdown renderer for F2-18 chat. Supports a deliberately
 * small subset so we don't drag in a 30 kB markdown library for a chat
 * line:
 *
 *   **bold**, *italic*, `code`,  ~~strike~~, [text](url), task embeds
 *   `[[task:KEY]]` and emoji shortcodes (`:+1:` → 👍).
 *
 * Block elements are line-broken — every newline becomes a <br/>. This
 * matches what every chat tool does and is what real users expect when
 * they hit Shift+Enter.
 *
 * Returns a React fragment, not a string. We never set innerHTML — all
 * tokens are plain text or known component substitutions, so XSS is
 * not possible.
 */
export function renderMessageBody(body, { orgSlug } = {}) {
  if (!body) return null;
  const lines = body.split('\n');
  return lines.map((line, lineIdx) => (
    <span key={lineIdx}>
      {renderLine(line, orgSlug)}
      {lineIdx < lines.length - 1 && <br />}
    </span>
  ));
}

// Tokeniser. Each pattern is tried in order against the line; the first
// match at index 0 wins and we advance the cursor. Anything that
// doesn't match a pattern becomes a literal text node so the render is
// strict — no half-parsed markdown leaks through.
function renderLine(line, orgSlug) {
  const out = [];
  let i = 0;
  let textBuf = '';
  const flush = () => {
    if (textBuf) {
      out.push(applyEmoji(textBuf));
      textBuf = '';
    }
  };

  while (i < line.length) {
    const rest = line.slice(i);

    // [[task:KEY]] — task card embed. Most specific pattern, try first.
    const taskMatch = rest.match(/^\[\[task:([A-Za-z][A-Za-z0-9]*-\d+)\]\]/);
    if (taskMatch) {
      flush();
      out.push(<TaskCardEmbed key={`task-${i}`} taskKey={taskMatch[1]} orgSlug={orgSlug} />);
      i += taskMatch[0].length;
      continue;
    }

    // [text](url) — inline link. Plain http(s) only; mailto: and other
    // schemes fall through as literal text so an injected javascript:
    // URL renders as text rather than a clickable hazard.
    const linkMatch = rest.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
    if (linkMatch) {
      flush();
      out.push(
        <a key={`a-${i}`} href={linkMatch[2]} target="_blank" rel="noreferrer noopener">
          {linkMatch[1]}
        </a>
      );
      i += linkMatch[0].length;
      continue;
    }

    // `code` — inline monospace.
    if (rest[0] === '`') {
      const end = rest.indexOf('`', 1);
      if (end > 0) {
        flush();
        out.push(<code key={`c-${i}`} className="msg-code">{rest.slice(1, end)}</code>);
        i += end + 1;
        continue;
      }
    }

    // **bold** — order matters: try ** before * so the longer marker wins.
    if (rest.startsWith('**')) {
      const end = rest.indexOf('**', 2);
      if (end > 0) {
        flush();
        out.push(<strong key={`b-${i}`}>{applyEmoji(rest.slice(2, end))}</strong>);
        i += end + 2;
        continue;
      }
    }

    // *italic*
    if (rest[0] === '*' && rest[1] !== ' ') {
      const end = rest.indexOf('*', 1);
      if (end > 0) {
        flush();
        out.push(<em key={`i-${i}`}>{applyEmoji(rest.slice(1, end))}</em>);
        i += end + 1;
        continue;
      }
    }

    // ~~strike~~
    if (rest.startsWith('~~')) {
      const end = rest.indexOf('~~', 2);
      if (end > 0) {
        flush();
        out.push(<s key={`s-${i}`}>{applyEmoji(rest.slice(2, end))}</s>);
        i += end + 2;
        continue;
      }
    }

    textBuf += rest[0];
    i += 1;
  }

  flush();
  return out;
}

/**
 * Curated emoji shortcode vocabulary. The full Unicode emoji set is
 * enormous; we keep the most common chat reactions here and let the
 * renderer leave unknown shortcodes as plain text — which acts as the
 * fallback when someone types `:potato:` and we haven't added it yet.
 */
export const EMOJI_MAP = {
  ':+1:': '👍',
  ':-1:': '👎',
  ':heart:': '❤️',
  ':tada:': '🎉',
  ':rocket:': '🚀',
  ':eyes:': '👀',
  ':fire:': '🔥',
  ':100:': '💯',
  ':smile:': '😄',
  ':joy:': '😂',
  ':sob:': '😭',
  ':thinking:': '🤔',
  ':wave:': '👋',
  ':white_check_mark:': '✅',
  ':x:': '❌',
  ':warning:': '⚠️',
  ':sparkles:': '✨',
  ':bug:': '🐛',
  ':bulb:': '💡',
  ':pray:': '🙏',
  ':clap:': '👏',
  ':star:': '⭐',
  ':coffee:': '☕',
  ':see_no_evil:': '🙈',
};

/** Quick-pick set shown in the reaction popover. */
export const QUICK_EMOJI = [':+1:', ':heart:', ':tada:', ':eyes:', ':fire:', ':rocket:', ':white_check_mark:', ':sparkles:'];

function applyEmoji(text) {
  if (!text.includes(':')) return text;
  return text.replace(/:[a-z0-9_+-]+:/gi, (m) => EMOJI_MAP[m.toLowerCase()] ?? m);
}

/** Render a shortcode as just the emoji glyph (for reaction chips). */
export function emojiGlyph(shortcode) {
  return EMOJI_MAP[shortcode] ?? shortcode;
}
