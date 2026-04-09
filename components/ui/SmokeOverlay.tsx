'use client';
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

const SmokeEffect = dynamic(() => import('./SmokeEffect'), { ssr: false });

export function SmokeOverlay() {
    // Remount SmokeEffect when the tab regains visibility — restores a
    // frozen/lost WebGL context without a visible hard cut (SmokeEffect
    // has its own 1.8s fade-in on mount).
    const [mountKey, setMountKey] = useState(0);

    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                setMountKey(k => k + 1);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, []);

    return (
        <div className="fixed inset-0 z-[3] pointer-events-none">
            <SmokeEffect key={mountKey} />
        </div>
    );
}
