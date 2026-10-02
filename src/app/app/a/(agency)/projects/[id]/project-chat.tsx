'use client';

import { MessageCircle, ArrowRight } from 'lucide-react';
import { useChat } from '@/components/chat/chat-provider';

export function ProjectChat({ channelId }: { channelId: string | null }) {
  const { openProjectChannel, conversations } = useChat();
  if (!channelId) return null;
  const conv = conversations.find((c) => c.id === channelId);
  const unread = conv?.unread ?? 0;

  return (
    <div style={{ border: '1px solid #E4E3DF', borderRadius: 20, padding: '18px 20px', marginBottom: 12, background: '#fff' }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.13em', color: '#909090', marginBottom: 14 }}>Projekt-Chat</div>
      <button
        onClick={() => openProjectChannel(channelId)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12, background: '#0A0A0A', color: '#fff', cursor: 'pointer', transition: 'transform .14s var(--ease)' }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
      >
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <MessageCircle size={17} />
        </div>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Chat öffnen</div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.55)' }}>
            {conv?.lastMessage && conv.lastMessage !== 'Noch keine Nachrichten' ? conv.lastMessage.slice(0, 38) : 'Mit dem Kunden kommunizieren'}
          </div>
        </div>
        {unread > 0 && (
          <span style={{ background: '#E53E3E', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 100, padding: '2px 8px', flexShrink: 0 }}>{unread}</span>
        )}
        <ArrowRight size={16} style={{ flexShrink: 0, opacity: .6 }} />
      </button>
    </div>
  );
}
