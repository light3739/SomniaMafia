// app/test-voice/page.tsx
'use client';

import React, { useState } from 'react';
import { VoiceChat } from '@/components/game/VoiceChat';
import { Mic, Users, Settings } from 'lucide-react';

export default function TestVoicePage() {
    const [roomId, setRoomId] = useState('test-room-' + Math.random().toString(36).substring(7));
    const [userName, setUserName] = useState('TestUser');
    const [isActive, setIsActive] = useState(false);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-3">
                        <Mic className="w-10 h-10 text-purple-400" />
                        Voice Chat Test
                    </h1>
                    <p className="text-gray-400">Test голосового чата для Somnia Mafia</p>
                </div>

                {/* Settings Panel */}
                <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl border border-purple-500/30 p-6 mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Settings className="w-5 h-5 text-purple-400" />
                        <h2 className="text-xl font-semibold text-white">Настройки</h2>
                    </div>

                    <div className="space-y-4">
                        {/* Room ID */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Room ID
                            </label>
                            <input
                                type="text"
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value)}
                                className="w-full px-4 py-2 bg-gray-700/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                                placeholder="test-room-123"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Несколько пользователей с одинаковым Room ID попадут в одну комнату
                            </p>
                        </div>

                        {/* User Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Your Name
                            </label>
                            <input
                                type="text"
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                className="w-full px-4 py-2 bg-gray-700/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                                placeholder="Player1"
                            />
                        </div>

                        {/* Connect Button */}
                        <button
                            onClick={() => setIsActive(!isActive)}
                            className={`w-full py-3 px-6 rounded-lg font-semibold transition-all ${isActive
                                    ? 'bg-red-500 hover:bg-red-600 text-white'
                                    : 'bg-purple-500 hover:bg-purple-600 text-white'
                                }`}
                        >
                            {isActive ? '🔴 Disconnect' : '🎙️ Connect to Voice Chat'}
                        </button>
                    </div>
                </div>

                {/* Instructions */}
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 mb-6">
                    <h3 className="text-lg font-semibold text-blue-300 mb-3 flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Как тестировать:
                    </h3>
                    <ol className="space-y-2 text-gray-300 text-sm">
                        <li className="flex gap-2">
                            <span className="text-purple-400 font-bold">1.</span>
                            <span>Откройте эту страницу в нескольких вкладках/окнах (или на разных устройствах)</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-purple-400 font-bold">2.</span>
                            <span>Используйте одинаковый <code className="bg-gray-700 px-1 rounded">Room ID</code> во всех вкладках</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-purple-400 font-bold">3.</span>
                            <span>Нажмите "Connect to Voice Chat" в каждой вкладке</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-purple-400 font-bold">4.</span>
                            <span>Разрешите доступ к микрофону когда браузер спросит</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-purple-400 font-bold">5.</span>
                            <span>Говорите в одной вкладке и слушайте в другой!</span>
                        </li>
                    </ol>
                </div>

                {/* Voice Chat Component */}
                {isActive && (
                    <div className="animate-fadeIn">
                        <VoiceChat
                            roomId={roomId}
                            userName={userName}
                            isActive={isActive}
                            label="Test Voice Room"
                            className="w-full"
                        />
                    </div>
                )}

                {/* Stats */}
                <div className="mt-6 text-center text-sm text-gray-500">
                    <p>Status: {isActive ? '🟢 Active' : '⚫ Inactive'}</p>
                    <p className="mt-1">Room: {roomId}</p>
                </div>
            </div>
        </div>
    );
}
