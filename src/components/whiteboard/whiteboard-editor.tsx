'use client';

import '@excalidraw/excalidraw/index.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ExcalidrawImperativeAPI, BinaryFiles } from '@excalidraw/excalidraw/types';
import type { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((m) => m.Excalidraw),
  {
    ssr: false,
    loading: () => (
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#909090', fontSize: 14, fontWeight: 500 }}>
        Whiteboard wird geladen …
      </div>
    ),
  },
);

export interface WhiteboardScene {
  elements: readonly OrderedExcalidrawElement[];
  files: BinaryFiles;
}

export type WbSaveResult = { version: number };
export type WbSyncResult = { version: number; sceneJson: string | null; updatedByName: string | null };

export interface WhiteboardEditorProps {
  boardId: string;
  initialScene: WhiteboardScene | null;
  initialVersion: number;
  canEdit: boolean;
  theme?: 'light' | 'dark';
  saveAction: (boardId: string, sceneJson: string, baseVersion: number) => Promise<WbSaveResult>;
  syncAction: (boardId: string, sinceVersion: number) => Promise<WbSyncResult>;
  onRemoteUpdate?: (name: string | null) => void;
  onStatusChange?: (status: SaveStatus) => void;
}

export type SaveStatus = 'idle' | 'saving' | 'saved';

function serialize(elements: readonly OrderedExcalidrawElement[], files: BinaryFiles): string {
  return JSON.stringify({ elements, files });
}

const SAVE_DEBOUNCE_MS = 900;
const POLL_MS = 2500;

export function WhiteboardEditor({
  boardId,
  initialScene,
  initialVersion,
  canEdit,
  theme = 'light',
  saveAction,
  syncAction,
  onRemoteUpdate,
  onStatusChange,
}: WhiteboardEditorProps) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const versionRef = useRef(initialVersion);
  const lastSentRef = useRef<string>(initialScene ? serialize(initialScene.elements, initialScene.files) : '');
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<SaveStatus>('idle');

  const setStat = useCallback((s: SaveStatus) => { setStatus(s); onStatusChange?.(s); }, [onStatusChange]);

  const doSave = useCallback(async () => {
    const api = apiRef.current;
    if (!api || !canEdit) return;
    const json = serialize(api.getSceneElements(), api.getFiles());
    if (json === lastSentRef.current) { dirtyRef.current = false; return; }
    savingRef.current = true;
    setStat('saving');
    try {
      const res = await saveAction(boardId, json, versionRef.current);
      versionRef.current = res.version;
      lastSentRef.current = json;
      dirtyRef.current = false;
      setStat('saved');
    } catch {
      // keep dirty; will retry on next change / unmount flush
    } finally {
      savingRef.current = false;
    }
  }, [boardId, canEdit, saveAction, setStat]);

  const handleChange = useCallback(() => {
    if (!canEdit) return;
    const api = apiRef.current;
    if (!api) return;
    const json = serialize(api.getSceneElements(), api.getFiles());
    if (json === lastSentRef.current) return; // unchanged or echo of a remote-applied scene
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void doSave(); }, SAVE_DEBOUNCE_MS);
  }, [canEdit, doSave]);

  // Poll for remote changes (collaboration via last-write-wins + version bump).
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (!active) return;
      try {
        // Don't clobber the user while they have unsaved local edits.
        if (!savingRef.current && !dirtyRef.current) {
          const res = await syncAction(boardId, versionRef.current);
          const api = apiRef.current;
          if (active && api && res.version > versionRef.current && res.sceneJson) {
            const parsed = JSON.parse(res.sceneJson) as WhiteboardScene;
            api.updateScene({ elements: parsed.elements });
            if (parsed.files && Object.keys(parsed.files).length) {
              api.addFiles(Object.values(parsed.files));
            }
            // Re-anchor against the normalized scene to avoid an echo save.
            lastSentRef.current = serialize(api.getSceneElements(), api.getFiles());
            versionRef.current = res.version;
            onRemoteUpdate?.(res.updatedByName);
          }
        }
      } catch {
        // network hiccup — keep polling
      }
      if (active) timer = setTimeout(() => { void tick(); }, POLL_MS);
    };
    timer = setTimeout(() => { void tick(); }, POLL_MS);
    return () => { active = false; clearTimeout(timer); };
  }, [boardId, syncAction, onRemoteUpdate]);

  // Flush pending edits on unmount / tab close.
  useEffect(() => {
    const flush = () => { if (dirtyRef.current) void doSave(); };
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (dirtyRef.current) void doSave();
    };
  }, [doSave]);

  return (
    <div style={{ position: 'absolute', inset: 0 }} data-status={status}>
      <Excalidraw
        excalidrawAPI={(api: ExcalidrawImperativeAPI) => { apiRef.current = api; }}
        initialData={{
          elements: initialScene?.elements ?? [],
          files: initialScene?.files ?? undefined,
          scrollToContent: true,
        }}
        onChange={handleChange}
        viewModeEnabled={!canEdit}
        theme={theme}
        langCode="de-DE"
        UIOptions={{ canvasActions: { loadScene: false } }}
      />
    </div>
  );
}
