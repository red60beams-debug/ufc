export interface StreamSource {
  id: string;
  name: string;
  url: string;
  verified: boolean;
  type: 'direct' | 'scraped';
  error?: string;
}

interface ScrapeTarget {
  id: string;
  name: string;
  homepage: string;
  depth?: number;
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const SCRAPE_TIMEOUT = 14000;
const VERIFY_TIMEOUT = 8000;

const DIRECT_SOURCES: StreamSource[] = [
  { id: 'soccerball', name: 'Soccer Ball', url: 'https://soccerball.st/rampages/unoairuf/', verified: true, type: 'direct' },
  { id: 'statusnode', name: 'StatusNode', url: 'https://statusnode.is/nodejs/?t=2', verified: true, type: 'direct' },
  { id: 'streamscenter', name: 'Streams Center', url: 'https://streams.center/embed/ch48.php', verified: true, type: 'direct' },
];

const SCRAPE_TARGETS: ScrapeTarget[] = [
  { id: 'totalsportek', name: 'TOTALSPORTEK', homepage: 'https://www.totalsportekpro.com/' },
  { id: 'streameast', name: 'StreamEast', homepage: 'https://www.streameast100.com/' },
  { id: 'footybite', name: 'Footybite', homepage: 'https://www.footybite.to/' },
  { id: 'soccerstreams', name: 'Soccer Streams', homepage: 'https://www.soccerstreams-free.com/' },
  { id: 'nflbite', name: 'NFLBITE', homepage: 'https://www.nflbite.to/' },
  { id: 'nbabite', name: 'NBABITE', homepage: 'https://reddit.nbabite.to/' },
  { id: 'sportsurge', name: 'SPORTSURGE', homepage: 'https://sportsurge100.com/' },
  { id: 'hesgoal', name: 'HESGOAL', homepage: 'https://hesgoalfree.com/' },
  { id: 'footballstreams', name: 'Football Streams', homepage: 'https://footballstreams.top/' },
  { id: 'crackstreams', name: 'CrackStreams', homepage: 'https://crackstreams.one/' },
  { id: 'methstreams', name: 'MethStreams', homepage: 'https://www.methstreams.pro/' },
  { id: 'f1streams', name: 'F1 Streams', homepage: 'https://www.f1streamsfree.com/' },
  { id: 'freestreams', name: 'Free Streams', homepage: 'https://freestreams-live.top/' },
  { id: 'hufoot', name: 'Hoofoot', homepage: 'https://hufoot.com/' },
  { id: 'stream2watch', name: 'Stream2Watch', homepage: 'https://stream2watch.football/' },
];

let cache: { sources: StreamSource[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

async function fetchPage(url: string, timeout = SCRAPE_TIMEOUT): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9' },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function verifyUrl(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT);
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeUrl(href: string, base: string): string {
  const trimmed = href.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('//')) return 'https:' + trimmed;
  try {
    return new URL(trimmed, base).href;
  } catch {
    return base;
  }
}

function containsUfc(text: string): boolean {
  const lower = text.toLowerCase();
  if (/\bufc\b/.test(lower)) return true;
  if (/\b(mma|ultimate?\s*fight(ing)?)\b/.test(lower)) return true;
  return false;
}

function extractEnhancedLinks(html: string): { href: string; text: string }[] {
  const links: { href: string; text: string }[] = [];
  const seen = new Set<string>();

  const patterns = [
    /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    /<a[^>]*href='([^']*)'[^>]*>([\s\S]*?)<\/a>/gi,
    /<a[^>]*href=([^\s>]+)[^>]*>([\s\S]*?)<\/a>/gi,
  ];

  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(html)) !== null) {
      const href = match[1].trim();
      const rawText = match[2];
      const text = rawText
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(c))
        .trim();
      if (href && text && !seen.has(href)) {
        seen.add(href);
        links.push({ href, text });
      }
    }
  }

  return links;
}

function extractEnhancedIframes(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const patterns = [
    /<iframe[^>]*src="([^"]*)"[^>]*>/gi,
    /<iframe[^>]*src='([^']*)'[^>]*>/gi,
    /<iframe[^>]*src=([^\s>]+)[^>]*>/gi,
    /<embed[^>]*src="([^"]*)"[^>]*>/gi,
    /<video[^>]*src="([^"]*)"[^>]*>/gi,
  ];

  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(html)) !== null) {
      const src = match[1].trim();
      if (src && !seen.has(src)) {
        seen.add(src);
        urls.push(src);
      }
    }
  }

  return urls;
}

function extractScriptEmbeds(html: string): string[] {
  const urls: string[] = [];
  const patterns = [
    /(?:https?:)?\/\/[^"'\s]*?(?:player|embed|stream|live)[^"'\s]*\.(?:php|html|js)[^"'\s]*/gi,
    /data-src=["']([^"']*)["']/gi,
    /data-embed=["']([^"']*)["']/gi,
  ];

  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(html)) !== null) {
      const url = match[1] || match[0];
      if (url && url.length > 10 && url.length < 300) {
        urls.push(url);
      }
    }
  }

  return urls;
}

function looksLikeStreamUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    /\.(m3u8|mp4|webm|flv|ts)$/i.test(lower) ||
    /(player|embed|stream|live|watch)/i.test(lower)
  );
}

async function scrapeAggregator(target: ScrapeTarget): Promise<StreamSource | null> {
  try {
    const html = await fetchPage(target.homepage);
    const links = extractEnhancedLinks(html);
    const iframes = extractEnhancedIframes(html);
    const scripts = extractScriptEmbeds(html);

    const ufcLinks = links.filter(l => containsUfc(l.href) || containsUfc(l.text));
    const streamIframes = iframes.filter(looksLikeStreamUrl);
    const streamScripts = scripts.filter(looksLikeStreamUrl);

    let embedUrl: string | null = null;

    if (streamIframes.length > 0) {
      embedUrl = streamIframes[0];
    }

    if (!embedUrl && ufcLinks.length > 0) {
      for (const link of ufcLinks) {
        try {
          const fullUrl = normalizeUrl(link.href, target.homepage);
          const pageHtml = await fetchPage(fullUrl);
          const pageIframes = extractEnhancedIframes(pageHtml);
          const pageEmbeds = pageIframes.filter(looksLikeStreamUrl);
          if (pageEmbeds.length > 0) {
            embedUrl = pageEmbeds[0];
            break;
          }
          if (target.depth && target.depth > 1) {
            const subLinks = extractEnhancedLinks(pageHtml);
            const subUfc = subLinks.filter(l => containsUfc(l.href) || containsUfc(l.text));
            for (const sub of subUfc) {
              try {
                const subUrl = normalizeUrl(sub.href, fullUrl);
                const subHtml = await fetchPage(subUrl);
                const subIframes = extractEnhancedIframes(subHtml);
                const subEmbeds = subIframes.filter(looksLikeStreamUrl);
                if (subEmbeds.length > 0) {
                  embedUrl = subEmbeds[0];
                  break;
                }
              } catch {}
            }
            if (embedUrl) break;
          }
        } catch {}
      }
    }

    if (!embedUrl && streamScripts.length > 0) {
      embedUrl = streamScripts[0];
    }

    if (!embedUrl) {
      return {
        id: target.id,
        name: target.name,
        url: target.homepage,
        verified: false,
        type: 'scraped',
        error: 'No stream embed found',
      };
    }

    embedUrl = embedUrl.startsWith('//') ? 'https:' + embedUrl : embedUrl;

    const verified = await verifyUrl(embedUrl);
    return {
      id: target.id,
      name: target.name,
      url: embedUrl,
      verified,
      type: 'scraped',
    };
  } catch (err: any) {
    return {
      id: target.id,
      name: target.name,
      url: target.homepage,
      verified: false,
      type: 'scraped',
      error: err.message,
    };
  }
}

export async function discoverSources(force = false): Promise<StreamSource[]> {
  if (!force && cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.sources;
  }

  const results: StreamSource[] = [...DIRECT_SOURCES];

  const scraped = await Promise.allSettled(
    SCRAPE_TARGETS.map(t => scrapeAggregator(t)),
  );

  for (const result of scraped) {
    if (result.status === 'fulfilled' && result.value) {
      results.push(result.value);
    }
  }

  cache = { sources: results, timestamp: Date.now() };
  return results;
}

export function getDirectSources(): StreamSource[] {
  return [...DIRECT_SOURCES];
}
