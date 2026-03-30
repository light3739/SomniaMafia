import React, { useState, useEffect, useRef } from 'react';

export const TypewriterText: React.FC<{ text: string; delay?: number; speed?: number }> = ({ text, delay = 0, speed = 45 }) => {
    const [displayText, setDisplayText] = useState(text);
    const [isAnimating, setIsAnimating] = useState(false);
    const targetTextRef = useRef(text);

    useEffect(() => {
        if (text === targetTextRef.current) return;
        
        setIsAnimating(true);
        targetTextRef.current = text;
        
        // Phase 1: Erase
        let currentText = displayText;
        const eraseInterval = setInterval(() => {
            if (currentText.length > 0) {
                currentText = currentText.slice(0, -1);
                setDisplayText(currentText);
            } else {
                clearInterval(eraseInterval);
                // Phase 2: Type new text
                let i = 0;
                const typeInterval = setInterval(() => {
                    if (i < text.length) {
                        setDisplayText(text.slice(0, i + 1));
                        i++;
                    } else {
                        clearInterval(typeInterval);
                        setIsAnimating(false);
                    }
                }, speed);
            }
        }, speed / 1.5);

        return () => {
            clearInterval(eraseInterval);
        };
    }, [text, speed]);

    return <span>{displayText}</span>;
};
