'use client';

import React from 'react';

/**
 * Minimaler Markdown-Renderer für Recherche-/Notiztexte (Lead-Analyse etc.):
 * ## Überschriften, - Aufzählungen, **fett**, `code`. Bewusst ohne Dependency
 * und ohne HTML-Injection — es entstehen nur React-Knoten.
 */

function inline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // **fett** und `code` abwechselnd herausschneiden.
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] !== undefined) nodes.push(<strong key={`${keyBase}-b${i++}`} style={{ color: 'var(--black)', fontWeight: 700 }}>{m[2]}</strong>);
    else nodes.push(<code key={`${keyBase}-c${i++}`} style={{ background: '#EFEEE9', borderRadius: 5, padding: '1px 5px', fontSize: '0.92em', fontFamily: 'ui-monospace, Menlo, monospace' }}>{m[3]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function MiniMarkdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];
  let k = 0;

  const flushList = () => {
    if (list.length) {
      out.push(<ul key={`ul-${k++}`} style={{ margin: '4px 0 8px', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>{list}</ul>);
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (/^#{1,4}\s+/.test(trimmed)) {
      flushList();
      out.push(<div key={`h-${k++}`} style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#909090', margin: '10px 0 4px' }}>{inline(trimmed.replace(/^#{1,4}\s+/, ''), `h${k}`)}</div>);
    } else if (/^[-*•]\s+/.test(trimmed)) {
      list.push(<li key={`li-${k++}`} style={{ fontSize: 13, color: '#3C3B38', lineHeight: 1.55 }}>{inline(trimmed.replace(/^[-*•]\s+/, ''), `l${k}`)}</li>);
    } else if (trimmed === '') {
      flushList();
    } else {
      flushList();
      out.push(<p key={`p-${k++}`} style={{ fontSize: 13, color: '#3C3B38', lineHeight: 1.6, margin: '2px 0' }}>{inline(trimmed, `p${k}`)}</p>);
    }
  }
  flushList();
  return <div>{out}</div>;
}
