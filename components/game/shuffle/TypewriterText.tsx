import React, { useState, useEffect, useRef } from 'react';

/**
 * A reliable typewriter component that only animates once on mount.
 * Prevents "re-typing" glitches when log contents are updated (e.g. addresses to nicknames).
 */
export const TypewriterText: React.FC<{ text: string; delay?: number; speed?: number }> = ({ text, delay = 0, speed = 30 }) => {
    const [displayText, setDisplayText] = useState('');
    const [isComplete, setIsComplete] = useState(false);
    const hasStartedRef = useRef(false);

    useEffect(() => {
        // If the component is already complete or text is identical to what we showed, don't restart.
        // This prevents re-animation when parent state updates but this log didn't change meaningfully.
        if (hasStartedRef.current) {
             setDisplayText(text); // Silently update if text changed (e.g. nickname resolve)
             return;
        }

        hasStartedRef.current = true;
        let i = 0;
        let timeoutId: any;
        let intervalId: any;

        const startTyping = () => {
            intervalId = setInterval(() => {
                if (i < text.length) {
                    setDisplayText(text.slice(0, i + 1));
                    i++;
                } else {
                    clearInterval(intervalId);
                    setIsComplete(true);
                }
            }, speed);
        };

        if (delay > 0) {
            timeoutId = setTimeout(startTyping, delay);
        } else {
            startTyping();
        }

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            if (intervalId) clearInterval(intervalId);
        };
    }, [text, delay, speed]);

    return <span>{displayText}</span>;
};

