
import React, { useEffect, useRef, useState } from "react";
import {
    motion,
    useMotionValue,
    useTransform,
    useSpring,
} from "framer-motion";

interface ElasticSliderProps {
    defaultValue?: number;
    min?: number;
    max?: number;
    step?: number;
    onChange?: (value: number) => void;
    className?: string;
    startingValue?: number;
}

export default function ElasticSlider({
    defaultValue = 0.5,
    min = 0,
    max = 1,
    step = 0.05,
    onChange,
    className = "",
    startingValue,
}: ElasticSliderProps) {
    const [value, setValue] = useState(startingValue ?? defaultValue);
    const containerRef = useRef<HTMLDivElement>(null);

    // Calculate initial percentage immediately for synchronous render
    const initialVal = startingValue ?? defaultValue;
    const initialPercentage = ((initialVal - min) / (max - min)) * 100;

    // Motion values for the slider logic
    // We map 0-100% (of width) to the value range
    const x = useMotionValue(initialPercentage);

    // Spring for the visual progress bar (smooth catchup)
    const scaleX = useSpring(useTransform(x, [0, 100], [0, 1]), {
        stiffness: 400,
        damping: 30,
    });

    // Spring for the handle position (elastic lag)
    const springX = useSpring(x, { stiffness: 400, damping: 30 });

    // Transform for handle "squish" effect during drag
    // We can use a state to track dragging for interaction
    const [isDragging, setIsDragging] = useState(false);

    const handleScaleY = useTransform(springX, (latest) => {
        // Simple mock of squish based on velocity or just state? 
        // The original code used a conditional transform based on external 'isDragging' state passed to it or similar.
        // Let's keep it simple: Squish when dragging.
        return isDragging ? 0.8 : 1;
    });

    // Update value based on mouse X position relative to container
    const updateValue = React.useCallback((clientX: number) => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            // Calculate percentage 0-100
            const rawPercent = Math.min(Math.max(((clientX - rect.left) / rect.width), 0), 1);

            // Calculate actual value
            const rawValue = rawPercent * (max - min) + min;

            // Snap to step
            const steppedValue = Math.round(rawValue / step) * step;

            // Constrain
            const finalValue = Math.min(Math.max(steppedValue, min), max);

            // Update state
            setValue(finalValue);

            // Update visual percentage (0-100 for x)
            const finalPercent = ((finalValue - min) / (max - min)) * 100;
            x.set(finalPercent);

            if (onChange) onChange(finalValue);
        }
    }, [max, min, step, onChange, x]);

    // Global drag listeners
    useEffect(() => {
        if (isDragging) {
            const handlePointerMove = (e: PointerEvent) => {
                updateValue(e.clientX);
            };

            const handlePointerUp = () => {
                setIsDragging(false);
            };

            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
            // Also handle pointercancel just in case
            window.addEventListener('pointercancel', handlePointerUp);

            return () => {
                window.removeEventListener('pointermove', handlePointerMove);
                window.removeEventListener('pointerup', handlePointerUp);
                window.removeEventListener('pointercancel', handlePointerUp);
            };
        }
    }, [isDragging, updateValue]);

    // Construct initial position
    useEffect(() => {
        const val = startingValue ?? defaultValue;
        const initialPercentage = ((val - min) / (max - min)) * 100;
        x.set(initialPercentage);
        setValue(val);
    }, [startingValue, defaultValue, min, max, x]);

    return (
        <div
            ref={containerRef}
            className={`relative h-6 w-full flex items-center cursor-pointer touch-none select-none ${className}`}
            onPointerDown={(e) => {
                setIsDragging(true);
                updateValue(e.clientX);
            }}
        >
            {/* Background Track */}
            <div className="absolute h-1.5 w-full bg-[#916A47]/20 rounded-full overflow-hidden">
                {/* Fill Track (Elastic) */}
                <motion.div
                    className="h-full bg-[#916A47] origin-left"
                    style={{ scaleX }}
                />
            </div>

            {/* Handle */}
            <motion.div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[#916A47] border-2 border-[#19130D] rounded-full shadow-[0_0_10px_rgba(145,106,71,0.5)] flex items-center justify-center z-10"
                style={{
                    left: useTransform(springX, (v) => `${v}%`),
                    x: "-50%", // Center the handle on the percentage point
                    scaleY: handleScaleY,
                    scaleX: handleScaleY, // Uniform squish
                }}
            >
                {/* Inner dot */}
                <div className="w-1 h-1 bg-[#19130D] rounded-full" />
            </motion.div>
        </div>
    );
}
