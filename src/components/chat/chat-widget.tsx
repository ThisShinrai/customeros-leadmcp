'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, X, ArrowLeft, Send, Plus, PenSquare } from 'lucide-react';
import { useChat } from './chat-provider';
import type { Conversation, Contact } from './chat-provider';
import { renderMentions } from './mention-text';
import { getInitials } from '@/lib/utils';
import { usePrivacy } from '@/components/privacy/privacy-mode';

/* ─── Avatar ─── */
function Avatar({ initials, size = 32 }: { initials: string; size?: number }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: '#0A0A0A',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.35,
      fontWeight: 600,
      flexShrink: 0,
      userSelect: 'none',
    }}>
      {initials}
    </div>
  );
}

/* ─── Conversation List Item ─── */
function ConversationItem({
  conv,
  onClick,
}: {
  conv: Conversation;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      role="button"
      aria-label={`Chat: ${conv.name}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '12px 16px',
        display: 'flex',
        gap: 10,
        cursor: 'pointer',
        background: hovered ? '#F4F3F0' : 'transparent',
        transition: 'background 120ms ease',
      }}
    >
      <Avatar initials={conv.initials} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0A0A0A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {conv.name}
          </span>
          <span style={{ fontSize: 11, color: '#909090', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {conv.timestamp}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 2 }}>
          <span style={{
            fontSize: 12,
            color: '#909090',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
          }}>
            {conv.typing
              ? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>schreibt …</span>
              : conv.lastMessage}
          </span>
          {conv.unread > 0 && (
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#0A0A0A',
              flexShrink: 0,
            }} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Message View ─── */
function MessageView({ conversationId }: { conversationId: string }) {
  const { conversations, activeMessages, loadingMessages, activeTyping, backToList, sendMessage, notifyTyping, participants, selfName } = useChat();
  const conv = conversations.find(c => c.id === conversationId);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Names to highlight in rendered messages (other participants + me).
  const mentionNames = [...participants.map(p => p.name), selfName];

  // ── @-mention autocomplete state ──
  // `query` is the partial text right after `@`; null means the dropdown is closed.
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  // Caret position we want to restore AFTER an accept re-renders the input.
  const pendingCaret = useRef<number | null>(null);

  // Matches an active mention token at the caret: an `@` after start-or-whitespace,
  // with no whitespace (and no further `@`) typed into the name yet.
  const MENTION_RE = /(^|\s)@([^\s@]*)$/;

  // Candidate list for the current query (case-insensitive: prefix matches first,
  // then other substring matches), capped at 6. Empty if no participants.
  const mentionMatches = (() => {
    if (mentionQuery === null || participants.length === 0) return [];
    const q = mentionQuery.toLowerCase();
    const prefix: typeof participants = [];
    const contains: typeof participants = [];
    for (const p of participants) {
      const name = p.name.toLowerCase();
      if (name.startsWith(q)) prefix.push(p);
      else if (q && name.includes(q)) contains.push(p);
    }
    return [...prefix, ...contains].slice(0, 6);
  })();
  const mentionOpen = mentionMatches.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length, activeTyping]);

  // Restore caret + focus after an accept changed the input value.
  useEffect(() => {
    if (pendingCaret.current != null && inputRef.current) {
      const pos = pendingCaret.current;
      pendingCaret.current = null;
      inputRef.current.focus();
      inputRef.current.setSelectionRange(pos, pos);
    }
  }, [inputValue]);

  if (!conv) return null;

  function handleSend() {
    const text = inputValue.trim();
    if (!text) return;
    sendMessage(text);
    setInputValue('');
    setMentionQuery(null);
  }

  // Recompute the mention query from the text up to the caret.
  function refreshMention(value: string, caret: number) {
    const upToCaret = value.slice(0, caret);
    const m = MENTION_RE.exec(upToCaret);
    if (m) { setMentionQuery(m[2]); setMentionIndex(0); }
    else setMentionQuery(null);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setInputValue(value);
    notifyTyping();
    refreshMention(value, e.target.selectionStart ?? value.length);
  }

  // Replace the `@fragment` at the caret with `@<full name> ` and reposition caret.
  function acceptMention(name: string) {
    const el = inputRef.current;
    const caret = el?.selectionStart ?? inputValue.length;
    const before = inputValue.slice(0, caret);
    const after = inputValue.slice(caret);
    const m = MENTION_RE.exec(before);
    if (!m) { setMentionQuery(null); return; }
    // Start index of the `@` (m[1] is the preceding whitespace/empty boundary).
    const at = before.length - (m[2].length + 1);
    const insert = `@${name} `;
    const next = before.slice(0, at) + insert + after;
    pendingCaret.current = at + insert.length;
    setInputValue(next);
    setMentionQuery(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (mentionOpen) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => (i + 1) % mentionMatches.length); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIndex(i => (i - 1 + mentionMatches.length) % mentionMatches.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); acceptMention(mentionMatches[mentionIndex].name); return; }
      if (e.key === 'Escape')    { e.preventDefault(); setMentionQuery(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Message view header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid #E4E3DF',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
      }}>
        <button
          onClick={backToList}
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: 'none',
            background: '#F4F3F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            color: '#0A0A0A',
          }}
        >
          <ArrowLeft size={14} />
        </button>
        <Avatar initials={conv.initials} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0A0A0A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {conv.name}
          </div>
          <div style={{ fontSize: 11, color: '#909090', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {conv.project}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {loadingMessages && activeMessages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#909090', fontSize: 12, paddingTop: 20 }}>Wird geladen…</div>
        )}
        {!loadingMessages && activeMessages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#909090', fontSize: 12.5, paddingTop: 30, lineHeight: 1.5 }}>
            Noch keine Nachrichten.<br />Schreiben Sie die erste Nachricht.
          </div>
        )}
        {activeMessages.map(msg => (
          <div
            key={msg.id}
            className="msg-in"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.own ? 'flex-end' : 'flex-start',
            }}
          >
            {!msg.own && msg.senderName && (
              <div style={{ fontSize: 10, color: '#909090', marginBottom: 2, paddingLeft: 4, fontWeight: 600 }}>{msg.senderName}</div>
            )}
            <div style={{ maxWidth: '75%' }}>
              <div style={{
                background: msg.own ? 'var(--accent)' : '#F4F3F0',
                color: msg.own ? '#fff' : '#0A0A0A',
                borderRadius: 12,
                padding: '8px 12px',
                fontSize: 13,
                lineHeight: 1.45,
                wordBreak: 'break-word',
              }}>
                {renderMentions(msg.text, mentionNames, selfName)}
              </div>
              <div style={{
                fontSize: 10,
                color: '#BDBDBD',
                marginTop: 3,
                textAlign: msg.own ? 'right' : 'left',
                paddingLeft: msg.own ? 0 : 4,
                paddingRight: msg.own ? 4 : 0,
              }}>
                {msg.time}
              </div>
            </div>
          </div>
        ))}
        {activeTyping && (
          <div className="msg-in" style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', background: '#F4F3F0', borderRadius: 12, padding: '10px 12px' }}>
            <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        borderTop: '1px solid #E4E3DF',
        padding: '10px 14px',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ flex: 1, position: 'relative' }}>
          {/* @-mention autocomplete dropdown — anchored just above the input */}
          {mentionOpen && (
            <div
              role="listbox"
              aria-label="Personen erwähnen"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 'calc(100% + 8px)',
                background: '#0A0A0A',
                borderRadius: 14,
                boxShadow: '0 12px 36px rgba(0,0,0,.32)',
                padding: 4,
                overflow: 'hidden',
                zIndex: 5,
              }}
            >
              {mentionMatches.map((p, i) => (
                <div
                  key={p.id}
                  role="option"
                  aria-selected={i === mentionIndex}
                  // onMouseDown (not onClick) so the input doesn't blur before we insert.
                  onMouseDown={e => { e.preventDefault(); acceptMention(p.name); }}
                  onMouseEnter={() => setMentionIndex(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: i === mentionIndex ? 'rgba(var(--accent-rgb),.18)' : 'transparent',
                    transition: 'background 100ms ease',
                  }}
                >
                  <span style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: i === mentionIndex ? 'var(--accent)' : '#fff',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    @{p.name}
                  </span>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#C8C8C8',
                    background: 'rgba(255,255,255,.10)',
                    borderRadius: 100,
                    padding: '2px 7px',
                    flexShrink: 0,
                  }}>
                    {p.type === 'client_user' ? 'Kunde' : 'Team'}
                  </span>
                </div>
              ))}
            </div>
          )}
          <input
            ref={inputRef}
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Nachricht schreiben…"
            style={{
              width: '100%',
              background: '#F4F3F0',
              border: 'none',
              borderRadius: 100,
              padding: '8px 14px',
              fontSize: 13,
              color: '#0A0A0A',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>
        <button
          onClick={handleSend}
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: '#0A0A0A',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#fff',
            flexShrink: 0,
            transition: 'opacity 120ms ease',
            opacity: inputValue.trim() ? 1 : 0.45,
          }}
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}

/* ─── Conversation List ─── */
function ConversationList() {
  const { conversations, selectConversation, openNewChat } = useChat();

  if (conversations.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', gap: 10 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F4F3F0', color: '#909090', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MessageCircle size={20} />
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0A0A0A' }}>Noch keine Unterhaltungen</div>
        <div style={{ fontSize: 12.5, color: '#909090', lineHeight: 1.5, maxWidth: 240 }}>Projekt-Chats erscheinen automatisch. Oder starten Sie direkt eine Unterhaltung.</div>
        <button onClick={openNewChat} style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent)', color: '#fff', borderRadius: 100, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}><Plus size={14} /> Neuer Chat</button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {conversations.map(conv => (
        <ConversationItem
          key={conv.id}
          conv={conv}
          onClick={() => selectConversation(conv.id)}
        />
      ))}
    </div>
  );
}

/* ─── Contacts (new chat) ─── */
function ContactRow({ contact, onClick }: { contact: Contact; onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', cursor: 'pointer', background: h ? '#F4F3F0' : 'transparent', transition: 'background .12s' }}>
      <Avatar initials={getInitials(contact.name)} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0A0A0A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contact.name}</div>
        <div style={{ fontSize: 11.5, color: '#909090', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {contact.type === 'client_user' ? 'Kunde' : 'Team'}{contact.subtitle ? ` · ${contact.subtitle}` : ''}
        </div>
      </div>
    </div>
  );
}

function ContactsList() {
  const { contacts, startDirect } = useChat();
  if (contacts.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', gap: 10 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F4F3F0', color: '#909090', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PenSquare size={20} /></div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0A0A0A' }}>Keine Kontakte verfügbar</div>
        <div style={{ fontSize: 12.5, color: '#909090', lineHeight: 1.5, maxWidth: 240 }}>Sie können nur Personen anschreiben, die einem gemeinsamen Projekt zugeordnet sind.</div>
      </div>
    );
  }
  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingTop: 4 }}>
      {contacts.map((c) => <ContactRow key={`${c.id}-${c.projectId}`} contact={c} onClick={() => startDirect(c)} />)}
    </div>
  );
}

/* ─── Chat Panel ─── */
function ChatPanel({ isOpen }: { isOpen: boolean }) {
  const { view, activeConversation, closeChat, openNewChat, backToList } = useChat();
  const blurStyle = usePrivacy().hideStyle();

  return (
    <div
      className="cos-chat-panel"
      style={{
        position: 'fixed',
        bottom: 90,
        right: 'max(16px, env(safe-area-inset-right))',
        zIndex: 999,
        width: 'min(360px, calc(100vw - 32px))',
        height: 'min(520px, calc(100dvh - 130px))',
        background: '#fff',
        borderRadius: 20,
        boxShadow: '0 20px 60px rgba(0,0,0,.18)',
        border: '1px solid #E4E3DF',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        // Animation
        opacity: isOpen ? 1 : 0,
        transform: isOpen ? 'scale(1) translateY(0)' : 'scale(.95) translateY(8px)',
        pointerEvents: isOpen ? 'auto' : 'none',
        transition: 'opacity 200ms cubic-bezier(.16,1,.3,1), transform 200ms cubic-bezier(.16,1,.3,1)',
      }}
    >
      {/* Panel Header */}
      <div style={{ padding: '16px 18px', borderBottom: '1px solid #E4E3DF', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {view === 'new' && (
            <button onClick={backToList} style={{ width: 26, height: 26, borderRadius: '50%', background: '#F4F3F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0A0A0A' }}><ArrowLeft size={13} /></button>
          )}
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0A0A0A' }}>{view === 'new' ? 'Neuer Chat' : 'Nachrichten'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {view === 'list' && (
            <button onClick={openNewChat} title="Neuer Chat" style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><PenSquare size={14} /></button>
          )}
          <button onClick={closeChat} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#F4F3F0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0A0A0A' }}><X size={14} /></button>
        </div>
      </div>

      {/* Panel Body — im Blur-Modus unkenntlich (Kundenkonversationen) */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, ...blurStyle }}>
        {view === 'new'
          ? <ContactsList />
          : view === 'conversation' && activeConversation
            ? <MessageView conversationId={activeConversation} />
            : <ConversationList />}
      </div>
    </div>
  );
}

/* ─── Chat Widget (root export) ─── */
export function ChatWidget() {
  const { isOpen, openChat, closeChat, unreadCount } = useChat();
  const pathname = usePathname();

  // The whiteboard is a full-bleed canvas with its own corner controls — the
  // floating chat button would cover them, so hide the widget on those routes.
  if (pathname?.includes('/whiteboard')) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        className="cos-chat-fab"
        onClick={isOpen ? closeChat : openChat}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: '#0A0A0A',
          border: 'none',
          boxShadow: '0 8px 32px rgba(0,0,0,.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#fff',
          // Tuck the button away while the panel is open so it never covers the
          // send button (esp. on mobile, where it's lifted above the bottom nav).
          opacity: isOpen ? 0 : 1,
          pointerEvents: isOpen ? 'none' : 'auto',
          transition: 'transform 150ms ease, box-shadow 150ms ease, opacity 180ms ease',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.06)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 40px rgba(0,0,0,.32)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(0,0,0,.25)';
        }}
        aria-label={isOpen ? 'Chat schließen' : 'Chat öffnen'}
      >
        <MessageCircle size={22} />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#E53E3E',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #fff',
            lineHeight: 1,
            userSelect: 'none',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>

      {/* Panel — always mounted, animated in/out */}
      <ChatPanel isOpen={isOpen} />
    </>
  );
}
