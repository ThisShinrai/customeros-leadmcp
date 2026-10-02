'use client';

import { MessageCircle, ArrowRight } from 'lucide-react';
import { useChat } from '@/components/chat/chat-provider';

export function PortalChatButton({ channelId }: { channelId: string | null }) {
  const { openProjectChannel, conversations } = useChat();
  if (!channelId) {
    return (
      <div style={{ fontSize: 13, color: '#b0b0b0', padding: '6px 0' }}>
        Für dieses Projekt ist noch kein Chat verfügbar.
      </div>
    );
  }
  const conv = conversations.find((c) => c.id === channelId);
  const unread = conv?.unread ?? 0;

  return (
    <button
      onClick={() => openProjectChannel(channelId)}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12, background: '#0A0A0A', color: '#fff', cursor: 'pointer', transition: 'transform .14s var(--ease)' }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <MessageCircle size={17} />
      </div>
      <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>Chat öffnen</div>
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {conv?.lastMessage && conv.lastMessage !== 'Noch keine Nachrichten' ? conv.lastMessage.slice(0, 38) : 'Mit Ihrer Agentur kommunizieren'}
        </div>
      </div>
      {unread > 0 && (
        <span style={{ background: '#E53E3E', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 100, padding: '2px 8px', flexShrink: 0 }}>{unread}</span>
      )}
      <ArrowRight size={16} style={{ flexShrink: 0, opacity: 0.6 }} />
    </button>
  );
}
