'use client';
import { useMemo, useState, useEffect } from 'react';
import { SmokeScene } from 'react-smoke';
import * as THREE from 'three';

export default function SmokeEffect() {
    const smokeColor = useMemo(() => new THREE.Color(254 / 255, 194 / 255, 139 / 255), []);
    const lightColor = useMemo(() => new THREE.Color(254 / 255, 194 / 255, 139 / 255), []);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 150);
        return () => clearTimeout(t);
    }, []);

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                opacity: visible ? 1 : 0,
                transition: 'opacity 1.8s ease',
                // Transparent hole in center — smoke only visible on edges/corners
                maskImage: 'radial-gradient(ellipse 55% 58% at 50% 50%, transparent 15%, black 60%)',
                WebkitMaskImage: 'radial-gradient(ellipse 55% 58% at 50% 50%, transparent 15%, black 60%)',
            }}
        >
            <SmokeScene
                gl={{ alpha: true, antialias: false }}
                scene={{ background: null }}
                frameloop="always"
                camera={{ fov: 60, position: [0, 0, 500], far: 6000 }}
                style={{ background: 'transparent', width: '100%', height: '100%', pointerEvents: 'none' }}
                ambientLightProps={{ intensity: 0.2, color: lightColor }}
                directionalLightProps={{ intensity: 3.5, position: [0, 1, 0.4], color: lightColor }}
                smoke={{
                    color: smokeColor,
                    density: 15,
                    opacity: 0.22,
                    enableRotation: true,
                    rotation: [0, 0, 0.05],
                    enableWind: true,
                    windStrength: [0.003, 0.001, 0],
                    enableTurbulence: true,
                    turbulenceStrength: [0.006, 0.004, 0.002],
                    size: [1800, 1400, 900],
                    minBounds: [-1600, -900, -400],
                    maxBounds: [1600, 900, 400],
                }}
            />
        </div>
    );
}
