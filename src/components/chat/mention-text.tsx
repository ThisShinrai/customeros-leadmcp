'use client';

import React from 'react';

/**
 * Renders a chat message string, wrapping any `@<name>` that matches a known
 * participant name or the current user's own name in a styled accent span.
 *
 * - Matching is case-insensitive and longest-name-first, so that a name that is
 *   a prefix of another (e.g. "@Anna" vs "@Anna Schmidt") never short-circuits
 *   the longer one. Names may contain spaces.
 * - When the matched mention is the current user (`selfName`), the span also gets
 *   a faint accent pill background so being mentioned visually stands out.
 * - XSS-safe: builds React nodes only, never dangerouslySetInnerHTML.
 */

/** Escape a string for safe use inside a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Datei-Referenzen in Nachrichten: `[datei:<id>|<Name>]` → klickbarer Chip. */
const FILE_TOKEN = /\[datei:([A-Za-z0-9_-]+)\|([^\]]+)\]/g;

function FileChip({ id, name }: { id: string; name: string }) {
  return (
    <a
      href={`/api/files/${id}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: '100%',
        padding: '2px 9px', borderRadius: 100, margin: '1px 0',
        background: 'rgba(var(--accent-rgb),.12)', color: 'var(--accent)',
        fontSize: '0.92em', fontWeight: 700, textDecoration: 'none',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom',
      }}
      title={`${name} öffnen`}
    >
      📎 {name}
    </a>
  );
}

export function renderMentions(
  text: string,
  names: string[],
  selfName: string,
): React.ReactNode {
  // Erst Datei-Tokens herausschneiden, dann Mentions auf den Textteilen rendern.
  FILE_TOKEN.lastIndex = 0;
  if (FILE_TOKEN.test(text)) {
    FILE_TOKEN.lastIndex = 0;
    const nodes: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    let k = 0;
    while ((m = FILE_TOKEN.exec(text)) !== null) {
      if (m.index > last) nodes.push(<React.Fragment key={`t-${k++}`}>{renderMentionsPlain(text.slice(last, m.index), names, selfName)}</React.Fragment>);
      nodes.push(<FileChip key={`f-${k++}`} id={m[1]} name={m[2]} />);
      last = m.index + m[0].length;
    }
    if (last < text.length) nodes.push(<React.Fragment key={`t-${k++}`}>{renderMentionsPlain(text.slice(last), names, selfName)}</React.Fragment>);
    return nodes;
  }
  return renderMentionsPlain(text, names, selfName);
}

function renderMentionsPlain(
  text: string,
  names: string[],
  selfName: string,
): React.ReactNode {
  // Unique, non-empty names, longest first so longer names win over their prefixes.
  const candidates = Array.from(
    new Set(names.filter((n) => n && n.trim().length > 0)),
  ).sort((a, b) => b.length - a.length);

  if (candidates.length === 0) return text;

  // `@(name1|name2|...)` — names already escaped. Word-boundary-ish on the right
  // is unnecessary because we match the full display name greedily (longest first).
  const pattern = new RegExp(
    '@(' + candidates.map(escapeRegExp).join('|') + ')',
    'gi',
  );

  const selfLower = selfName.trim().toLowerCase();
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));

    const isSelf = match[1].trim().toLowerCase() === selfLower;
    nodes.push(
      <span
        key={`m-${key++}`}
        style={{
          color: 'var(--accent)',
          fontWeight: 600,
          ...(isSelf
            ? {
                background: 'rgba(var(--accent-rgb),.14)',
                borderRadius: 5,
                padding: '0 3px',
              }
            : null),
        }}
      >
        {match[0]}
      </span>,
    );

    lastIndex = end;
    // Guard against zero-length matches (shouldn't happen, the leading @ is required).
    if (end === start) pattern.lastIndex++;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));

  return nodes;
}
