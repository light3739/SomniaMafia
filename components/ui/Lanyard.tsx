
"use client";

import { useEffect, useRef, useState } from "react";
import Matter from "matter-js";

interface LanyardProps {
    children: React.ReactNode;
    gravity?: number; // default 1
    wireLength?: number; // default 150
    className?: string;
}

export const Lanyard: React.FC<LanyardProps> = ({
    children,
    gravity = 1,
    wireLength = 150,
    className = ""
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    // Physics refs to keep track across re-renders
    const engineRef = useRef<Matter.Engine | null>(null);
    const renderRef = useRef<Matter.Render | null>(null);
    const runnerRef = useRef<Matter.Runner | null>(null);

    // Dimensions
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!containerRef.current || !canvasRef.current || !cardRef.current) return;

        // 1. Setup Matter.js Engine
        const engine = Matter.Engine.create();
        const world = engine.world;
        engineRef.current = engine;

        // 2. Dimensions
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({ width: clientWidth, height: clientHeight });

        // 3. Renderer (only for the wire/debug, we will render the card via DOM)
        // We use a transparent canvas on top
        const render = Matter.Render.create({
            canvas: canvasRef.current,
            engine: engine,
            options: {
                width: clientWidth,
                height: clientHeight,
                background: 'transparent',
                wireframes: false,
                pixelRatio: window.devicePixelRatio
            }
        });
        renderRef.current = render;

        // 4. Create Bodies
        // Anchor point (top center)
        const anchor = Matter.Bodies.circle(clientWidth / 2, -20, 10, {
            isStatic: true,
            render: { visible: false }
        });

        // Card Body (matches the DOM element size roughly)
        const cardWidth = 400; // Fixed width from RoleReveal
        const cardHeight = 400; // Fixed height from RoleReveal
        const cardBody = Matter.Bodies.rectangle(clientWidth / 2, wireLength + cardHeight / 2, cardWidth, cardHeight, {
            chamfer: { radius: 20 },
            density: 0.005,
            frictionAir: 0.05,
            restitution: 0.2, // Bounciness
            render: { visible: false } // We render DOM instead
        });

        // Chain (Constraint)
        const constraint = Matter.Constraint.create({
            bodyA: anchor,
            pointA: { x: 0, y: 0 },
            bodyB: cardBody,
            pointB: { x: 0, y: -cardHeight / 2 + 20 }, // Attach near top of card
            stiffness: 0.1, // Elasticitity
            damping: 0.1,
            length: wireLength,
            render: {
                visible: true,
                lineWidth: 2,
                strokeStyle: '#916A47', // Theme color
                type: 'line'
            }
        });

        Matter.World.add(world, [anchor, cardBody, constraint]);

        // 5. Mouse Interaction
        const mouse = Matter.Mouse.create(containerRef.current);
        const mouseConstraint = Matter.MouseConstraint.create(engine, {
            mouse: mouse,
            constraint: {
                stiffness: 0.2,
                render: { visible: false }
            }
        });

        // Fix: Allow scrolling and clicking through calls
        // We need to allow events to pass to the DOM button if not dragging
        // But Matter.js captures events on the element it's attached to (containerRef).
        // We might need to manually forward clicks or ensure the DOM element is interactive.
        // Actually, common issue. Let's try standard MouseConstraint first.
        // To allow clicks on buttons inside the card, we might need to verify if we are dragging.

        Matter.World.add(world, mouseConstraint);

        // Keep the mouse in sync with the screen
        render.mouse = mouse;

        // 6. Run the engine
        const runner = Matter.Runner.create();
        runnerRef.current = runner;
        Matter.Runner.run(runner, engine);
        Matter.Render.run(render);

        // 7. Sync Loop
        let animationFrameId: number;
        const updateLoop = () => {
            if (!cardRef.current || !cardBody) return;

            // Sync DOM element to Physics Body
            const { position, angle } = cardBody;
            const x = position.x - cardWidth / 2;
            const y = position.y - cardHeight / 2;

            cardRef.current.style.transform = `translate(${x}px, ${y}px) rotate(${angle}rad)`;

            animationFrameId = requestAnimationFrame(updateLoop);
        };
        updateLoop();

        // Resize handling
        const handleResize = () => {
            if (!containerRef.current) return;
            const { clientWidth, clientHeight } = containerRef.current;
            setDimensions({ width: clientWidth, height: clientHeight });

            render.canvas.width = clientWidth;
            render.canvas.height = clientHeight;

            // Reposition anchor
            Matter.Body.setPosition(anchor, { x: clientWidth / 2, y: -20 });
        };
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameId);
            Matter.Render.stop(render);
            Matter.Runner.stop(runner);
            if (engineRef.current) Matter.World.clear(engineRef.current.world, false);
            if (engineRef.current) Matter.Engine.clear(engineRef.current);
        };
    }, [gravity, wireLength]);

    return (
        <div
            ref={containerRef}
            className={`relative w-full h-[800px] overflow-hidden ${className}`}
            style={{ touchAction: 'none' }} // Prevent scrolling while interacting
        >
            {/* Canvas for Wire */}
            <canvas
                ref={canvasRef}
                className="absolute inset-0 pointer-events-none z-10"
            />

            {/* Card Container (Absolute, moved by physics) */}
            <div
                ref={cardRef}
                className="absolute top-0 left-0 will-change-transform z-20"
                style={{
                    width: '400px',
                    height: '400px',
                    // Initial center position to prevent jump
                    // transform: 'translate(calc(50% - 200px), 200px)' 
                }}
            >
                {children}
            </div>
        </div>
    );
};
