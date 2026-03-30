import React, { useState, useEffect } from 'react';
import { BASE_WIDTH, BASE_HEIGHT } from './playerLayoutUtils';

interface ResponsiveGameContainerProps {
    children: React.ReactNode;
}

export const ResponsiveGameContainer: React.FC<ResponsiveGameContainerProps> = ({ children }) => {
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const handleResize = () => {
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            const scaleX = windowWidth / BASE_WIDTH;
            const scaleY = windowHeight / BASE_HEIGHT;
            const isPortrait = windowHeight > windowWidth;
            let newScale = Math.min(scaleX, scaleY);

            if (isPortrait && windowWidth < 768) {
                const mobileScale = (windowWidth * 0.96) / 1100;
                newScale = Math.max(newScale, mobileScale);
            }
            setScale(newScale || 1);
        };

        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div
            className="relative transform-gpu transition-transform duration-200 ease-out"
            style={{
                width: BASE_WIDTH,
                height: BASE_HEIGHT,
                transform: `scale(${scale})`,
                flexShrink: 0
            }}
        >
            {children}
        </div>
    );
};
