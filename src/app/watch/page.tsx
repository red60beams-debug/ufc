'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface StreamSource {
  id: string;
  name: string;
  url: string;
  verified: boolean;
}

const ERROR_TIMEOUT = 25000;
const HIDE_LOADER_AFTER = 6000;

export default function WatchPage() {
  const [sources, setSources] = useState<StreamSource[]>([]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [chatSrc, setChatSrc] = useState('');
  const [eventStatus, setEventStatus] = useState<'live' | 'upcoming' | 'finished' | null>(null);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    setChatSrc(`https://www.youtube.com/live_chat?v=RlrRro00XYY&embed_domain=${encodeURIComponent(window.location.hostname)}`);
  }, []);

  useEffect(() => {
    fetch('/api/stream-sources')
      .then(r => r.json())
      .then(res => {
        if (res.sources?.length > 0) {
          setSources(res.sources);
        } else {
          setFetchError(true);
        }
      })
      .catch(() => setFetchError(true));
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
    const hideLoader = setTimeout(() => setLoading(false), HIDE_LOADER_AFTER);
    const showError = setTimeout(() => setError(true), ERROR_TIMEOUT);
    return () => { clearTimeout(hideLoader); clearTimeout(showError); };
  }, [loading, retry]);

  const currentSource = sources[sourceIndex];

  const handleNextSource = useCallback(() => {
    if (sourceIndex < sources.length - 1) {
      setSourceIndex(i => i + 1);
      setLoading(true);
      setError(false);
      setRetry(k => k + 1);
    }
  }, [sourceIndex, sources.length]);

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
          {sources.length > 1 && currentSource && (
            <span className="text-[10px] text-zinc-500 px-2 py-1 bg-zinc-800/50 rounded">
              {sourceIndex + 1}/{sources.length}
            </span>
          )}
        </div>
      </header>

      <div className="lg:h-[calc(100dvh-45px)] lg:overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:h-full">
          <div className="relative bg-black lg:flex-1 lg:flex lg:flex-col">
            <div className="relative w-full lg:flex-1 lg:min-h-0" style={{ aspectRatio: '16/9' }}>
              {loading && !error && currentSource && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-900">
                  <div className="flex flex-col items-center gap-5">
                    <div className="relative">
                      <div className="w-12 h-12 border-2 border-zinc-800 rounded-full" />
                      <div className="absolute inset-0 w-12 h-12 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-sm text-zinc-300 font-medium">Loading stream</p>
                      <p className="text-[10px] text-zinc-600">{currentSource.name}</p>
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
                        {sourceIndex < sources.length - 1
                          ? `${currentSource?.name} failed. Trying next source...`
                          : 'All sources are down. Try again later.'}
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
                      {sourceIndex < sources.length - 1 && (
                        <button
                          onClick={handleNextSource}
                          className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          Next Source
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {fetchError && !currentSource && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-900">
                  <div className="flex flex-col items-center gap-5 text-center px-6 max-w-xs">
                    <p className="text-sm text-zinc-300 font-medium">No stream sources available</p>
                    <p className="text-xs text-zinc-500">Try again later or check back during an event.</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="px-5 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold"
                    >
                      Reload
                    </button>
                  </div>
                </div>
              )}

              {currentSource && (
                <iframe
                  key={`${currentSource.id}-${retry}`}
                  src={currentSource.url}
                  className={`w-full h-full border-0 transition-opacity duration-500 ${loading && !error ? 'opacity-0' : 'opacity-100'}`}
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  onLoad={() => { setLoading(false); setError(false); }}
                  onError={() => { if (loading) setError(true); }}
                />
              )}
            </div>
          </div>

          <div className="hidden lg:flex lg:w-[420px] lg:min-w-[320px] lg:flex-col lg:border-l lg:border-zinc-800/60 lg:bg-zinc-950/80">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800/60">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs uppercase tracking-widest font-semibold text-zinc-300">Live Chat</span>
            </div>
            <div className="flex-1 min-h-0">
              <iframe
                src={chatSrc}
                className="w-full h-full border-0"
                allow="clipboard-write"
              />
            </div>
          </div>
        </div>

        <div className="lg:hidden border-t border-zinc-800/60 bg-zinc-950/80">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800/60">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs uppercase tracking-widest font-semibold text-zinc-300">Live Chat</span>
          </div>
          <div className="h-[50vh]">
            <iframe
              src={chatSrc}
              className="w-full h-full border-0"
              allow="clipboard-write"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
