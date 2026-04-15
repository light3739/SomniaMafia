'use client';

import { usePathname } from 'next/navigation';

export function TwitterFloating() {
  const pathname = usePathname();
  if (pathname?.startsWith('/game')) return null;

  return (
    <a
      href="https://x.com/MafiaOnChain"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Follow MafiaOnChain on X"
      className="fixed bottom-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white transition-all duration-200 hover:bg-black/70 hover:scale-110"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    </a>
  );
}
