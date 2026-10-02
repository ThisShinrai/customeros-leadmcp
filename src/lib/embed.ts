/** Detect the provider of a resource URL and (where safe) an embeddable iframe URL. */
export interface EmbedInfo {
  provider: string;
  iframeUrl: string | null;
}

export function embedInfo(rawUrl: string): EmbedInfo {
  let host = '';
  try { host = new URL(rawUrl).hostname.replace(/^www\./, ''); } catch { return { provider: 'Link', iframeUrl: null }; }
  const enc = encodeURIComponent(rawUrl);

  if (host.includes('figma.com')) {
    return { provider: 'Figma', iframeUrl: `https://www.figma.com/embed?embed_host=share&url=${enc}` };
  }
  if (host.includes('loom.com')) {
    const m = rawUrl.match(/loom\.com\/(?:share|embed)\/([\w-]+)/);
    return { provider: 'Loom', iframeUrl: m ? `https://www.loom.com/embed/${m[1]}` : null };
  }
  if (host.includes('youtube.com') || host.includes('youtu.be')) {
    const m = rawUrl.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/);
    return { provider: 'YouTube', iframeUrl: m ? `https://www.youtube.com/embed/${m[1]}` : null };
  }
  if (host.includes('docs.google.com') || host.includes('drive.google.com')) {
    return { provider: 'Google', iframeUrl: rawUrl.replace(/\/(edit|view)(\?[^#]*)?(#.*)?$/, '/preview') };
  }
  if (host.includes('calendly.com')) return { provider: 'Calendly', iframeUrl: rawUrl };
  if (host.includes('notion.so') || host.includes('notion.site')) return { provider: 'Notion', iframeUrl: rawUrl };
  if (host.includes('miro.com')) {
    const m = rawUrl.match(/miro\.com\/app\/board\/([\w=-]+)/);
    return { provider: 'Miro', iframeUrl: m ? `https://miro.com/app/live-embed/${m[1]}` : null };
  }
  return { provider: host, iframeUrl: null };
}
