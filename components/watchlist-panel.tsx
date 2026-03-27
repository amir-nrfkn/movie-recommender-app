'use client';

import { Bookmark, ChevronRight } from 'lucide-react';
import type { WatchlistItem } from '@/types/library';

export function WatchlistPanel({
  items,
  onOpen,
}: {
  items: WatchlistItem[];
  onOpen: (item: WatchlistItem) => void;
}) {
  return (
    <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
            <Bookmark size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Watchlist</h2>
            <p className="text-xs text-white/50">Newest saved movies first</p>
          </div>
        </div>
      </div>
      <div className="max-h-[65vh] overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-6 text-sm text-white/50">Your watchlist is empty.</div>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              onClick={() => onOpen(item)}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left border-b border-white/5 hover:bg-white/5 transition-colors"
            >
              <div>
                <div className="font-medium text-white">{item.title}</div>
                <div className="text-xs text-white/50">{item.year || 'Unknown year'}</div>
              </div>
              <ChevronRight size={16} className="text-white/40" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
