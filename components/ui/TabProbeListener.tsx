'use client';

import { useEffect } from 'react';

export function TabProbeListener() {
    useEffect(() => {
        if (typeof BroadcastChannel === 'undefined') return;
        const ch = new BroadcastChannel('somnia_mafia_tab_probe');
        ch.onmessage = (ev) => {
            if (ev.data === 'ping') {
                try { ch.postMessage('pong'); } catch {}
            }
        };
        return () => {
            try { ch.close(); } catch {}
        };
    }, []);
    return null;
}
