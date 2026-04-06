import React, { useState, useEffect, createContext, useContext } from 'react';
import { BASE_WIDTH, BASE_HEIGHT } from './playerLayoutUtils';

interface ResponsiveGameContainerProps {
    children: React.ReactNode;
    mobileChildren?: React.ReactNode;
}

const MobileContext = createContext(false);
export const useIsMobileGame = () => useContext(MobileContext);

export const ResponsiveGameContainer: React.FC<ResponsiveGameContainerProps> = ({ children, mobileChildren }) => {
    const [scale, setScale] = useState(1);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            const mobile = windowWidth < 768;
            setIsMobile(mobile);

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

    if (isMobile && mobileChildren) {
        return (
            <MobileContext.Provider value={true}>
                <div className="w-full h-[100dvh] flex flex-col overflow-hidden">
                    {mobileChildren}
                </div>
            </MobileContext.Provider>
        );
    }

    return (
        <MobileContext.Provider value={false}>
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
        </MobileContext.Provider>
    );
};
