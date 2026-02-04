'use client';

import { useState } from 'react';
import { LiveKitVoiceChat } from '@/components/game/LiveKitVoiceChat';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Volume2 } from 'lucide-react';
import Link from 'next/link';

export default function TestVoicePage() {
    const [roomId, setRoomId] = useState('');
    const [userName, setUserName] = useState('');
    const [isActive, setIsActive] = useState(false);

    const handleStart = () => {
        if (roomId.trim() && userName.trim()) {
            setIsActive(true);
        }
    };

    const handleStop = () => {
        setIsActive(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-black via-[#0a0a0a] to-black flex flex-col items-center justify-center p-4">
            <div className="max-w-2xl w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <Volume2 className="w-8 h-8 text-purple-400" />
                        <h1 className="text-4xl font-['Playfair_Display'] text-white">
                            Voice Chat Test
                        </h1>
                    </div>
                    <p className="text-gray-400">
                        Test LiveKit voice chat with your friends
                    </p>
                </div>

                {/* Main Content */}
                <div className="bg-gray-900/50 border border-purple-500/30 rounded-lg p-6 backdrop-blur-sm">
                    {!isActive ? (
                        <div className="space-y-4">
                            {/* Room ID Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Room Name
                                </label>
                                <input
                                    type="text"
                                    value={roomId}
                                    onChange={(e) => setRoomId(e.target.value)}
                                    placeholder="Enter room name (e.g., test-room-123)"
                                    className="w-full px-4 py-3 bg-black/40 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Share this room name with your friend to join the same voice chat
                                </p>
                            </div>

                            {/* Username Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Your Name
                                </label>
                                <input
                                    type="text"
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                    placeholder="Enter your name"
                                    className="w-full px-4 py-3 bg-black/40 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                                />
                            </div>

                            {/* Start Button */}
                            <Button
                                onClick={handleStart}
                                disabled={!roomId.trim() || !userName.trim()}
                                variant="primary"
                                className="w-full h-12 text-lg"
                            >
                                <Volume2 className="w-5 h-5 mr-2" />
                                Join Voice Chat
                            </Button>

                            {/* Instructions */}
                            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 mt-6">
                                <h3 className="text-sm font-semibold text-purple-300 mb-2">
                                    How to test:
                                </h3>
                                <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
                                    <li>Enter a room name (both you and your friend should use the same name)</li>
                                    <li>Enter your name</li>
                                    <li>Click "Join Voice Chat"</li>
                                    <li>Allow microphone access when prompted</li>
                                    <li>Your friend should do the same from another device/browser</li>
                                </ol>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Active Voice Chat */}
                            <LiveKitVoiceChat
                                roomId={roomId}
                                userName={userName}
                                isActive={isActive}
                                label={`Voice Room: ${roomId}`}
                                className="w-full"
                            />

                            {/* Stop Button */}
                            <Button
                                onClick={handleStop}
                                variant="secondary"
                                className="w-full h-12"
                            >
                                Leave Voice Chat
                            </Button>

                            {/* Info */}
                            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                                <p className="text-sm text-green-300 text-center">
                                    ✓ Connected to room: <span className="font-bold">{roomId}</span>
                                </p>
                                <p className="text-xs text-gray-400 text-center mt-1">
                                    Share this room name with your friend to test together
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Back Link */}
                <div className="mt-6 text-center">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
