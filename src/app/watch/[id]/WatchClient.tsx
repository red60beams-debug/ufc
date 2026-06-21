'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface WatchEvent {
  id: string;
  name: string;
  date: string;
  venue?: string;
  location?: string;
  status?: string;
  fighter1?: string;
  fighter2?: string;
  fighter1Record?: string;
  fighter2Record?: string;
  fighter1Img?: string;
  fighter2Img?: string;
  weightClass?: string;
  fights?: any[];
}

function isLiveEvent(date: string): boolean {
  const now = Date.now();
  const eventTime = new Date(date).getTime();
  const diff = Math.abs(now - eventTime);
  return diff < 14400000;
}

function getEmbedUrl(url: string): string {
  if (url.includes('youtube.com/watch')) {
    const v = url.split('v=')[1]?.split('&')[0];
    return v ? `https://www.youtube.com/embed/${v}?autoplay=1` : url;
  }
  if (url.includes('youtu.be/')) {
    const v = url.split('youtu.be/')[1]?.split('?')[0];
    return v ? `https://www.youtube.com/embed/${v}?autoplay=1` : url;
  }
  return url;
}

export default function WatchClient({ event }: { event: WatchEvent }) {
  const [showChat, setShowChat] = useState(true);
  const isLive = isLiveEvent(event.date);

  useEffect(() => {
    document.title = `${event.fighter1} vs ${event.fighter2} - Watch Live`;
  }, [event]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col lg:flex-row">
      <div className="flex-1 relative bg-black flex items-center justify-center min-h-0">
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-3 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-3">
            <Link href="/"
              className="text-white/60 hover:text-white text-xs uppercase tracking-wider transition flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Link>
            <span className="text-white/30 hidden sm:inline">|</span>
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-white text-sm font-semibold truncate max-w-[200px]">
                {event.fighter1} vs {event.fighter2}
              </span>
              <span className="text-gray-500 text-xs">{event.name}</span>
              {isLive && (
                <span className="flex items-center gap-1 bg-ufc-red/20 text-ufc-red text-[10px] px-2 py-0.5 rounded-full font-bold">
                  <span className="w-1.5 h-1.5 bg-ufc-red rounded-full animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {event.weightClass && (
              <span className="text-gray-500 text-[10px] uppercase tracking-wider hidden md:inline">{event.weightClass}</span>
            )}
            <button
              onClick={() => setShowChat(!showChat)}
              className="lg:hidden text-white/60 hover:text-white p-2 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="w-full h-full flex items-center justify-center bg-black">
          <iframe
            src={getEmbedUrl('https://www.youtube.com/watch?v=6K1DpNAioTI')}
            className="w-full h-full"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-white text-sm font-bold">{event.fighter1} vs {event.fighter2}</p>
                <p className="text-gray-400 text-xs">{event.name} · {event.venue || 'TBA'}</p>
              </div>
            </div>
            {isLive && (
              <div className="flex items-center gap-2 text-green-400 text-xs">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Live
              </div>
            )}
          </div>
        </div>
      </div>

      {showChat && (
        <div className="w-full lg:w-[420px] bg-[#0d0d0d] border-t lg:border-t-0 lg:border-l border-gray-800/50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <span className="text-white text-xs uppercase tracking-wider font-semibold">Live Chat</span>
            </div>
            <button
              onClick={() => setShowChat(false)}
              className="text-gray-500 hover:text-white text-lg transition"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-gray-600 text-xs text-center">Chat will appear here when available.</p>
          </div>
        </div>
      )}
    </div>
  );
}
