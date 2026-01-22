'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <html>
            <body className="bg-black text-white flex flex-col items-center justify-center min-h-screen p-4 font-sans">
                <div className="bg-[#1a1a1a] border border-red-900/50 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
                    <h2 className="text-2xl font-[Playfair_Display] text-red-500 mb-4">Critical System Failure</h2>
                    <p className="text-white/70 mb-6">
                        An unexpected error has occurred in the Mafia protocol.
                    </p>
                    <div className="bg-black/50 p-4 rounded-lg mb-6 text-left overflow-hidden">
                        <p className="text-red-400 font-mono text-xs break-all">
                            {error.message || 'Unknown Error'}
                        </p>
                        {error.digest && (
                            <p className="text-white/30 font-mono textxs mt-2">ID: {error.digest}</p>
                        )}
                    </div>
                    <div className="flex gap-4 justify-center">
                        <Button
                            variant="primary"
                            onClick={() => reset()}
                        >
                            Retry Connection
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => window.location.href = '/'}
                        >
                            Return to Safehouse
                        </Button>
                    </div>
                </div>
            </body>
        </html>
    );
}
