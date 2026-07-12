import { rawQueryOrThrow, query } from './db';

const BASE = 'https://fullfightreplays.com';
const SCRAPE_PATH = '/ufc';
const MAX_RETRIES = 1;

async function fetchPage(url: string): Promise<string> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err: any) {
      if (attempt === MAX_RETRIES) throw new Error(`Failed to fetch ${url}: ${err.message}`);
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  throw new Error('Unreachable');
}

function extractBetween(text: string, before: string, after: string, startIdx = 0): string | null {
  const s = text.indexOf(before, startIdx);
  if (s === -1) return null;
  const e = text.indexOf(after, s + before.length);
  if (e === -1) return null;
  return text.substring(s + before.length, e);
}

function extractAllBetween(text: string, before: string, after: string): string[] {
  const results: string[] = [];
  let idx = 0;
  while (true) {
    const s = text.indexOf(before, idx);
    if (s === -1) break;
    const e = text.indexOf(after, s + before.length);
    if (e === -1) break;
    results.push(text.substring(s + before.length, e));
    idx = e + after.length;
  }
  return results;
}

interface ScrapedEntry {
  title: string;
  url: string;
  thumbnail: string | null;
  category: string;
  views: number;
}

interface VideoEmbed {
  platform: string;
  url: string;
  label: string;
}

interface ScrapedFight {
  title: string;
  slug: string;
  promotion: string;
  eventName: string;
  fighter1: string;
  fighter2: string;
  thumbnail: string | null;
  videoUrl: string;
  embedSources: VideoEmbed[];
  eventDate: string | null;
  sourceUrl: string;
}

const PLATFORM_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'dailymotion', pattern: /geo\.dailymotion\.com\/player\.html\?video=([a-zA-Z0-9]+)/ },
  { name: 'okru', pattern: /ok\.ru\/videoembed\/(\d+)/ },
  { name: 'vidara', pattern: /vidara\.so\/v\/([a-zA-Z0-9]+)/ },
  { name: 'filemoon', pattern: /bysesukior\.com\/d\/([a-zA-Z0-9]+)/ },
];

function identifyPlatform(url: string): string {
  for (const p of PLATFORM_PATTERNS) {
    if (p.pattern.test(url)) return p.name;
  }
  return 'other';
}

function extractVideoEmbeds(html: string): VideoEmbed[] {
  const embeds: VideoEmbed[] = [];
  const links = extractAllBetween(html, '<a ', '</a>');
  for (const link of links) {
    const hrefMatch = link.match(/href="([^"]*)"/);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    const platform = identifyPlatform(href);
    if (platform === 'other') continue;
    const spanMatch = link.match(/<span>([^<]*)<\/span>/);
    const label = spanMatch ? spanMatch[1].trim() : 'Watch';
    embeds.push({ platform, url: href, label });
  }
  const iframes = extractAllBetween(html, '<iframe ', '</iframe>');
  for (const iframe of iframes) {
    const srcMatch = iframe.match(/src="([^"]*)"/);
    if (!srcMatch) continue;
    let src = srcMatch[1];
    if (src.startsWith('//')) src = 'https:' + src;
    const platform = identifyPlatform(src);
    if (platform === 'other') continue;
    embeds.push({ platform, url: src, label: 'Embed' });
  }
  return embeds;
}

function extractListEntries(html: string): ScrapedEntry[] {
  const entries: ScrapedEntry[] = [];
  const segments = html.split(/<div[^>]*id="entryID(\d+)"[^>]*>/);

  for (let i = 1; i < segments.length; i += 2) {
    const content = segments[i + 1] || '';

    const titleMatch = content.match(/<h3>.*?<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/);
    if (!titleMatch) continue;
    const url = titleMatch[1];
    const title = titleMatch[2].trim();

    const thumbMatch = content.match(/<div class="poster"[^>]*>[\s\S]*?<a[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"/);
    const thumbnail = thumbMatch ? thumbMatch[1] : null;

    const catMatch = content.match(/short_cat[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/);
    const category = catMatch ? catMatch[2].trim() : '';

    const viewsMatch = content.match(/short_icn[^>]*>[\s\S]*?<span[^>]*>(\d+)<\/span>/);
    const views = viewsMatch ? parseInt(viewsMatch[1]) : 0;

    const fullUrl = url.startsWith('http') ? url : `${BASE}${url}`;
    entries.push({ title, url: fullUrl, thumbnail, category, views });
  }

  return entries;
}

function extractPageTitle(html: string): string {
  const m = html.match(/<h1 class="h_title">([^<]*)<\/h1>/);
  return m ? m[1].trim() : '';
}

function extractCategory(html: string): string {
  const m = html.match(/entAllCats[^>]*>([^<]*)<\/a>/);
  return m ? m[1].trim() : '';
}

function extractDescription(html: string): string {
  const m = html.match(/<meta name="description" content="([^"]*)"/);
  return m ? m[1].trim() : '';
}

function extractMainImage(html: string): string | null {
  const m = html.match(/<div class="full_img"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"/);
  return m ? m[1] : null;
}

function normalizeThumbnail(src: string | null): string | null {
  if (!src) return null;
  if (src.startsWith('http')) return src;
  if (src.startsWith('/')) return `${BASE}${src}`;
  return `${BASE}/${src}`;
}

function parseFighters(title: string): { fighter1: string; fighter2: string } {
  const vsPatterns = [
    /(.+?)\s+vs\.?\s+(.+?)(?:\s+-\s+|$)/i,
    /(.+?)\s+vs\.?\s+(.+)/i,
  ];
  for (const pattern of vsPatterns) {
    const m = title.match(pattern);
    if (m) {
      const f1 = m[1].trim().replace(/^Full Fight Replay:?\s*/i, '').replace(/^Watch\s*/i, '');
      const f2 = m[2].trim().replace(/-.*$/, '').trim();
      if (f1 && f2 && f1.length > 1 && f2.length > 1) {
        return { fighter1: f1, fighter2: f2 };
      }
    }
  }
  return { fighter1: '', fighter2: '' };
}

function determinePromotion(category: string, title: string): string {
  const lower = (title + ' ' + category).toLowerCase();
  if (lower.includes('ufc')) return 'UFC';
  if (lower.includes('boxing')) return 'Boxing';
  if (lower.includes('one championship') || lower.includes('one fc')) return 'ONE Championship';
  if (lower.includes('bellator')) return 'Bellator MMA';
  if (lower.includes('pfl')) return 'PFL';
  if (lower.includes('bkfc')) return 'BKFC';
  if (lower.includes('cage warriors')) return 'Cage Warriors';
  if (lower.includes('invicta')) return 'Invicta FC';
  if (lower.includes('ksw')) return 'KSW';
  if (lower.includes('k-1') || lower.includes('kickboxing') || lower.includes('glory')) return 'K-1 Muay Thai & Kickboxing';
  return 'MMA';
}

function parseDate(title: string, description: string, html: string): string | null {
  const text = title + ' ' + description;
  const months = '(?:January|February|March|April|May|June|July|August|September|October|November|December)';
  const patterns = [
    new RegExp(`(${months})\\s+(\\d{1,2}),?\\s+(\\d{4})`),
    new RegExp(`(\\d{4})-(\\d{2})-(\\d{2})`),
    new RegExp(`(\\d{1,2})\\s+(${months})\\s+(\\d{4})`),
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      try {
        const d = new Date(m[0]);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      } catch {}
    }
  }
  return null;
}

function extractEntryDate(html: string): string | null {
  const m = html.match(/entry-date[^>]*>([^<]*)</);
  if (m) {
    try {
      const d = new Date(m[1].trim());
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    } catch {}
  }
  return null;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function scrapeAll(maxPages = 10): Promise<{
  pagesScanned: number;
  entriesFound: number;
  newFights: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let newFights = 0;
  let entriesFound = 0;
  let pagesScanned = 0;

  try {
    const start = Date.now();
    console.log('[FFR-SCRAPER] Starting scrape of fullfightreplays.com');

    const entries: ScrapedEntry[] = [];
    const pageResults = await Promise.allSettled(
      Array.from({ length: maxPages }, (_, i) => {
        const page = i + 1;
        const url = page === 1 ? `${BASE}${SCRAPE_PATH}` : `${BASE}${SCRAPE_PATH}?page${page}`;
        return fetchPage(url).then(html => {
          const pageEntries = extractListEntries(html);
          console.log(`[FFR-SCRAPER] Page ${page}: ${pageEntries.length} entries`);
          return pageEntries;
        });
      })
    );
    for (let i = 0; i < pageResults.length; i++) {
      const r = pageResults[i];
      if (r.status === 'fulfilled') {
        entries.push(...r.value);
        pagesScanned++;
      } else {
        errors.push(`Page ${i + 1}: ${r.reason?.message || 'failed'}`);
      }
    }

    entriesFound = entries.length;
    console.log(`[FFR-SCRAPER] Total entries collected: ${entries.length}`);

    const existingSlugs = new Set<string>();
    try {
      const existing = await query`SELECT slug FROM ufc_replays WHERE source = 'fullfightreplays'`;
      existing.forEach((r: any) => existingSlugs.add(r.slug));
    } catch {}

    const BATCH = 5;
    for (let i = 0; i < entries.length; i += BATCH) {
      const batch = entries.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(async (entry): Promise<boolean> => {
          const entrySlug = slugify(entry.title);
          if (existingSlugs.has(entrySlug)) return false;

          const html = await fetchPage(entry.url);
          const pageTitle = extractPageTitle(html) || entry.title;
          const category = extractCategory(html) || entry.category;
          const description = extractDescription(html);
          const mainImage = extractMainImage(html) || entry.thumbnail;
          const embeds = extractVideoEmbeds(html);
          const eventDate = parseDate(pageTitle, description, html) || extractEntryDate(html);

          if (embeds.length === 0) {
            throw new Error(`${pageTitle}: no video embeds found`);
          }

          const fighters = parseFighters(pageTitle);
          const promotion = determinePromotion(category, pageTitle);
          const primaryVideo = embeds[0].url.startsWith('http') ? embeds[0].url : `https:${embeds[0].url}`;
          const thumbnail = normalizeThumbnail(mainImage);
          const embedSources = JSON.stringify(embeds);

          await rawQueryOrThrow(
            `INSERT INTO ufc_replays 
             (title, slug, promotion, event_name, fighter1, fighter2, thumbnail, video_url, event_date, description, source, embed_sources, published, views, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,1,0,NOW(),NOW())`,
            [
              pageTitle, entrySlug, promotion, pageTitle,
              fighters.fighter1 || pageTitle, fighters.fighter2 || '',
              thumbnail, primaryVideo, eventDate,
              description || category, 'fullfightreplays', embedSources,
            ]
          );
          console.log(`[FFR-SCRAPER]  + ${pageTitle} (${promotion}, ${embeds.length} embeds)`);
          return true;
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) newFights++;
        else if (r.status === 'rejected') errors.push(r.reason?.message || 'unknown error');
      }
    }

    const elapsed = Date.now() - start;
    console.log(`[FFR-SCRAPER] Done: ${pagesScanned} pages, ${entriesFound} entries, ${newFights} new, ${errors.length} errors, ${elapsed}ms`);
  } catch (err: any) {
    errors.push(`Fatal: ${err.message}`);
    console.error('[FFR-SCRAPER] Fatal:', err.message);
  }

  return { pagesScanned, entriesFound, newFights, errors };
}
