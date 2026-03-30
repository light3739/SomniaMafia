import React, { useState, useEffect } from 'react';

export const AsciiSpinner: React.FC<{ className?: string }> = ({ className = '' }) => {
    const [frame, setFrame] = useState(0);
    const frames = ['|', '/', '-', '\\'];
    useEffect(() => {
        const iv = setInterval(() => setFrame(p => (p + 1) % frames.length), 120);
        return () => clearInterval(iv);
    }, []);
    return <span className={`font-mono font-bold inline-block ${className}`}>{frames[frame]}</span>;
};
