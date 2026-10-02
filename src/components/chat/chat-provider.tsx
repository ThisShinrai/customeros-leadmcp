'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  getConversations, getMessages, sendMessage as sendMessageAction, markChannelRead,
  getAllowedContacts, startDirectChannel, setTyping,
  type ChatConversation, type ChatMessage, type ChatContact,
} from './actions';
import { getChatToken } from './ws-token';
import { getChannelParticipants, notifyMention, type MentionTarget } from './mention-actions';

export type Conversation = ChatConversation;
export type Message = ChatMessage;
export type Contact = ChatContact;

export interface ChatIdentity {
  kind: 'agency_user' | 'client_user';
  id: string;
  name: string;
  agencyId: string;
}

type View = 'list' | 'conversation' | 'new';

interface ChatContextValue {
  isOpen: boolean;
  view: View;
  activeConversation: string | null;
  conversations: Conversation[];
  activeMessages: Message[];
  contacts: Contact[];
  participants: MentionTarget[];
  selfName: string;
  unreadCount: number;
  loadingMessages: boolean;
  activeTyping: boolean;
  hasIdentity: boolean;
  realtime: boolean;
  openChat: () => void;
  closeChat: () => void;
  selectConversation: (id: string) => void;
  backToList: () => void;
  sendMessage: (text: string) => void;
  notifyTyping: () => void;
  openNewChat: () => void;
  startDirect: (contact: Contact) => void;
  openProjectChannel: (channelId: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (ts: number) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

interface WsIncoming {
  type: 'msg' | 'typing';
  userId?: string;
  cid?: string;
  message?: { id: string; channelId: string; senderId: string; senderType: string; content: string; createdAt: number; senderName?: string };
}

export function ChatProvider({ children, identity }: { children: React.ReactNode; identity?: ChatIdentity }) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<View>('list');
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [participants, setParticipants] = useState<MentionTarget[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [wsTyping, setWsTyping] = useState(false);
  const [realtime, setRealtime] = useState(false);

  const activeRef = useRef<string | null>(null);
  const openRef = useRef(false);
  const lastTypingSent = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const wsConnectedRef = useRef(false);
  const participantsRef = useRef<MentionTarget[]>([]);
  activeRef.current = activeConversation;
  openRef.current = isOpen;
  participantsRef.current = participants;

  const refreshConversations = useCallback(async () => {
    try { setConversations(await getConversations()); } catch { /* offline */ }
  }, []);

  const loadMessages = useCallback(async (channelId: string, markRead: boolean) => {
    try {
      const msgs = await getMessages(channelId);
      if (activeRef.current === channelId) setActiveMessages(msgs);
      if (markRead) { await markChannelRead(channelId); refreshConversations(); }
    } catch { /* ignore */ }
  }, [refreshConversations]);

  // Poll: conversation list always; active-channel messages only when the live
  // WebSocket is NOT connected (it pushes those instantly). Polling stays the
  // guaranteed fallback whenever realtime is unavailable.
  useEffect(() => {
    if (!identity) return;
    refreshConversations();
    const iv = setInterval(() => {
      refreshConversations();
      if (openRef.current && activeRef.current && !wsConnectedRef.current) loadMessages(activeRef.current, true);
    }, 2500);
    return () => clearInterval(iv);
  }, [identity, refreshConversations, loadMessages]);

  // Real-time WebSocket for the active conversation (one connection at a time).
  useEffect(() => {
    if (!identity || !activeConversation) { wsConnectedRef.current = false; setRealtime(false); return; }
    const channelId = activeConversation;
    const myId = identity.id;
    let closed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let typingTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    async function open() {
      if (closed) return;
      let tok: { token: string; wsUrl: string } | null = null;
      try { tok = await getChatToken(channelId); } catch { tok = null; }
      if (closed) return;
      if (!tok) { wsConnectedRef.current = false; setRealtime(false); return; } // → polling fallback
      try {
        ws = new WebSocket(`${tok.wsUrl}/ws?room=${encodeURIComponent(channelId)}&token=${encodeURIComponent(tok.token)}`);
      } catch { scheduleReconnect(); return; }
      wsRef.current = ws;

      ws.onopen = () => { attempt = 0; wsConnectedRef.current = true; setRealtime(true); };
      ws.onerror = () => { try { ws?.close(); } catch { /* noop */ } };
      ws.onclose = () => {
        wsConnectedRef.current = false; setRealtime(false);
        if (wsRef.current === ws) wsRef.current = null;
        scheduleReconnect();
      };
      ws.onmessage = (ev) => {
        let data: WsIncoming;
        try { data = JSON.parse(ev.data as string); } catch { return; }
        if (data.type === 'typing') {
          if (data.userId && data.userId !== myId) {
            setWsTyping(true);
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => setWsTyping(false), 3500);
          }
          return;
        }
        if (data.type === 'msg' && data.message) {
          const m = data.message;
          if (m.channelId !== activeRef.current) return;
          const msg: Message = {
            id: m.id, text: m.content, own: m.senderId === myId,
            time: hhmm(m.createdAt), senderName: m.senderName ?? '', createdAt: m.createdAt,
          };
          setActiveMessages((prev) => {
            if (data.cid && prev.some((p) => p.id === data.cid)) return prev.map((p) => (p.id === data.cid ? msg : p));
            if (prev.some((p) => p.id === msg.id)) return prev;
            return [...prev, msg];
          });
          if (msg.own) { refreshConversations(); }
          else { markChannelRead(m.channelId).then(() => refreshConversations()).catch(() => {}); }
        }
      };
    }
    function scheduleReconnect() {
      if (closed) return;
      attempt += 1;
      const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(open, delay);
    }

    open();
    return () => {
      closed = true;
      clearTimeout(reconnectTimer); clearTimeout(typingTimer);
      wsConnectedRef.current = false; setRealtime(false); setWsTyping(false);
      try { ws?.close(); } catch { /* noop */ }
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [identity, activeConversation, refreshConversations]);

  const unreadCount = conversations.reduce((s, c) => s + c.unread, 0);
  const polledTyping = conversations.find((c) => c.id === activeConversation)?.typing ?? false;
  const activeTyping = wsTyping || polledTyping;

  const openChat = useCallback(() => setIsOpen(true), []);
  const closeChat = useCallback(() => { setIsOpen(false); setView('list'); setActiveConversation(null); setActiveMessages([]); setParticipants([]); }, []);

  const selectConversation = useCallback((id: string) => {
    setActiveConversation(id); setActiveMessages([]); setView('conversation'); setLoadingMessages(true); setWsTyping(false);
    setParticipants([]);
    getChannelParticipants(id).then(setParticipants).catch(() => setParticipants([]));
    loadMessages(id, true).finally(() => setLoadingMessages(false));
  }, [loadMessages]);

  const backToList = useCallback(() => { setActiveConversation(null); setActiveMessages([]); setView('list'); setParticipants([]); }, []);

  const sendMessage = useCallback(async (text: string) => {
    const channelId = activeRef.current;
    const trimmed = text.trim();
    if (!channelId || !trimmed) return;
    const tempId = `tmp-${Date.now()}-${conversations.length}`;
    const now = new Date();
    const optimistic: Message = {
      id: tempId, text: trimmed, own: true,
      time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
      senderName: identity?.name ?? '', createdAt: now.getTime(),
    };
    setActiveMessages((prev) => [...prev, optimistic]);

    // @-mentions: notify any participant whose name appears as @Name in the text.
    const mentioned = participantsRef.current.filter((p) => trimmed.includes('@' + p.name)).map((p) => p.id);
    if (mentioned.length) notifyMention(channelId, mentioned).catch(() => {});

    // Live path: send over the socket → the DO persists + echoes back (reconciled by cid).
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'msg', content: trimmed, n: identity?.name ?? '', cid: tempId }));
        return;
      } catch { /* fall through to the server action */ }
    }
    // Fallback path: persist via server action + let polling deliver it.
    try {
      const real = await sendMessageAction(channelId, trimmed);
      if (real) setActiveMessages((prev) => prev.map((m) => (m.id === tempId ? real : m)));
      refreshConversations();
    } catch { /* keep optimistic */ }
  }, [conversations.length, identity?.name, refreshConversations]);

  // Throttled typing heartbeat (≤ 1 / 2s) — over the socket if live, else server.
  const notifyTyping = useCallback(() => {
    const id = activeRef.current;
    if (!id) return;
    const now = Date.now();
    if (now - lastTypingSent.current < 2000) return;
    lastTypingSent.current = now;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ type: 'typing' })); return; } catch { /* fall through */ }
    }
    setTyping(id).catch(() => {});
  }, []);

  const openNewChat = useCallback(async () => {
    setIsOpen(true); setView('new');
    try { setContacts(await getAllowedContacts()); } catch { setContacts([]); }
  }, []);

  const startDirect = useCallback(async (contact: Contact) => {
    try {
      const { channelId } = await startDirectChannel(contact.id, contact.type, contact.projectId);
      await refreshConversations();
      selectConversation(channelId);
    } catch { /* ignore */ }
  }, [refreshConversations, selectConversation]);

  const openProjectChannel = useCallback((channelId: string) => {
    setIsOpen(true); selectConversation(channelId);
  }, [selectConversation]);

  return (
    <ChatContext.Provider value={{
      isOpen, view, activeConversation, conversations, activeMessages, contacts, participants, selfName: identity?.name ?? '', unreadCount, loadingMessages,
      activeTyping, hasIdentity: !!identity, realtime,
      openChat, closeChat, selectConversation, backToList, sendMessage, notifyTyping, openNewChat, startDirect, openProjectChannel,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within a ChatProvider');
  return ctx;
}
