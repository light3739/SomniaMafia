import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

interface SessionStatusBannerProps {
    address?: string | null;
    roomId?: string | number | bigint | null;
    isTestMode?: boolean;
    className?: string;
}

export const SessionStatusBanner: React.FC<SessionStatusBannerProps> = ({
    address, roomId, isTestMode, className,
}) => {
    const [sessionInvalid, setSessionInvalid] = useState<{ bad: boolean; reason: string }>({ bad: false, reason: '' });

    useEffect(() => {
        if (isTestMode || !address || !roomId) {
            setSessionInvalid({ bad: false, reason: '' });
            return;
        }
        const check = () => {
            try {
                const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('somnia_mafia_session') : null;
                const raw = stored ? JSON.parse(stored) : null;
                if (!raw) return setSessionInvalid({ bad: true, reason: 'missing' });
                if (raw.mainWallet?.toLowerCase() !== address.toLowerCase()) {
                    return setSessionInvalid({ bad: true, reason: 'wallet mismatch' });
                }
                try {
                    if (BigInt(raw.roomId) !== BigInt(roomId as any)) {
                        return setSessionInvalid({ bad: true, reason: 'room mismatch' });
                    }
                } catch {
                    return setSessionInvalid({ bad: true, reason: 'room invalid' });
                }
                if (typeof raw.expiresAt !== 'number' || Date.now() >= raw.expiresAt) {
                    return setSessionInvalid({ bad: true, reason: 'expired' });
                }
                setSessionInvalid({ bad: false, reason: '' });
            } catch {
                setSessionInvalid({ bad: true, reason: 'parse error' });
            }
        };
        check();
        const iv = setInterval(check, 3000);
        return () => clearInterval(iv);
    }, [isTestMode, address, roomId]);

    if (!sessionInvalid.bad) return null;

    return (
        <div className={`w-full px-3 py-2 rounded-md border border-orange-500/40 bg-orange-500/10 flex items-start gap-2 ${className || ''}`}>
            <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
            <p className="text-orange-200 text-[11px] leading-tight">
                Session lost ({sessionInvalid.reason}). Game actions will require a wallet signature popup. Refresh the page or rejoin the room to restore auto-signing.
            </p>
        </div>
    );
};
