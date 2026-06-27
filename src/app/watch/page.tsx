'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const STREAM_URL = 'https://streams.center/embed/ch48.php';
const LOAD_TIMEOUT = 20000;

export default function WatchPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatSrc, setChatSrc] = useState('');
  const [eventStatus, setEventStatus] = useState<'live' | 'upcoming' | 'finished' | null>(null);

  useEffect(() => {
    setChatOpen(window.innerWidth >= 1024);
    setChatSrc(`https://www.youtube.com/live_chat?v=RlrRro00XYY&embed_domain=${encodeURIComponent(window.location.hostname)}`);
  }, []);

  useEffect(() => {
    fetch('/api/ufc/events?limit=1').then(r => r.json()).then(res => {
      if (!res.data?.[0]) return;
      const e = res.data[0];
      const eventDate = new Date(e.date);
      const now = new Date();
      if (e.statusState === 'in') {
        setEventStatus('live');
      } else if (eventDate.toDateString() === now.toDateString() || (Math.abs(eventDate.getTime() - now.getTime()) < 14400000 && eventDate <= now)) {
        setEventStatus('live');
      } else if (eventDate > now) {
        setEventStatus('upcoming');
      } else {
        setEventStatus('finished');
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setError(true), LOAD_TIMEOUT);
    return () => clearTimeout(t);
  }, [loading, retry]);

  return (
    <main className="min-h-dvh bg-black text-white overflow-hidden select-none">
      <header className="flex items-center justify-between px-3 py-2.5 bg-zinc-900/80 border-b border-zinc-800/50">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors group"
        >
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">Back</span>
        </Link>
        <div className="flex items-center gap-2">
          {eventStatus === 'live' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600/10 border border-red-600/20">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-[10px] uppercase tracking-widest text-red-400 font-semibold">Live</span>
            </div>
          )}
          {eventStatus === 'upcoming' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-600/10 border border-yellow-600/20">
              <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
              <span className="text-[10px] uppercase tracking-widest text-yellow-400 font-semibold">Starts Soon</span>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-col" style={{ height: 'calc(100dvh - 45px)' }}>
        <div className="flex flex-1 min-h-0 lg:flex-row">
          <div className="relative bg-black flex-1 flex flex-col">
            <div className="relative flex-1 min-h-0">
              {loading && !error && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-900">
                  <div className="flex flex-col items-center gap-5">
                    <div className="relative">
                      <div className="w-12 h-12 border-2 border-zinc-800 rounded-full" />
                      <div className="absolute inset-0 w-12 h-12 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-sm text-zinc-300 font-medium">Loading stream</p>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-900">
                  <div className="flex flex-col items-center gap-5 text-center px-6 max-w-xs">
                    <div className="w-14 h-14 rounded-full bg-red-600/15 flex items-center justify-center">
                      <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-300 font-medium mb-1">Stream unavailable</p>
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        Connection timed out. The source may be down.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setLoading(true); setError(false); setRetry(k => k + 1); }}
                        className="px-5 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Retry
                      </button>
                      <a
                        href={STREAM_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Open Site
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <iframe
                key={retry}
                src={STREAM_URL}
                className={`w-full h-full border-0 transition-opacity duration-500 ${loading ? 'opacity-0' : 'opacity-100'}`}
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                onLoad={() => { setLoading(false); setError(false); }}
              />
            </div>
          </div>

          <button
            onClick={() => setChatOpen(c => !c)}
            className={`lg:hidden fixed bottom-20 right-4 z-30 w-11 h-11 rounded-full bg-red-600 shadow-lg shadow-red-600/30 flex items-center justify-center active:scale-90 transition-transform duration-200 ${chatOpen ? 'hidden' : 'flex'}`}
            aria-label="Open chat"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>

          {chatOpen && (
            <div
              onClick={() => setChatOpen(false)}
              className="lg:hidden fixed inset-0 z-10 bg-black/60 animate-in fade-in duration-200"
            />
          )}

          <div
            className={`${chatOpen ? 'translate-x-0' : 'translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-out lg:static fixed inset-y-0 right-0 z-20 lg:z-auto flex w-full lg:w-[420px] lg:min-w-[320px] border-l border-zinc-800/60 bg-zinc-950/80 flex-col shrink-0`}
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-800/60">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs uppercase tracking-widest font-semibold text-zinc-300">Live Chat</span>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="lg:hidden p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                aria-label="Close chat"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <iframe
                src={chatSrc}
                className="w-full h-full border-0 min-h-[400px] lg:min-h-0"
                allow="clipboard-write"
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
