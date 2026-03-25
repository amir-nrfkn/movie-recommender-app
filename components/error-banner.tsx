'use client';

import { AnimatePresence, motion } from 'motion/react';

export function ErrorBanner({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl bg-red-500/90 backdrop-blur-md text-white text-sm font-medium shadow-lg border border-red-400/30 max-w-sm text-center"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
