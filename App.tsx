import React from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MainPage } from './components/MainPage';
import { SetupProfile } from './components/lobby_flow/SetupProfile';
import { CreateLobby } from './components/lobby_flow/CreateLobby';
import { JoinLobby } from './components/lobby_flow/JoinLobby';
import { WaitingRoom } from './components/lobby_flow/WaitingRoom';
import { GameLayout } from './components/game/GameLayout';
import { MockGameLayout } from './components/game/MockGameLayout';
import { BackgroundMusic } from './components/ui/BackgroundMusic';
import { useGameContext } from './contexts/GameContext';

const App: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // We use the location as key for AnimatePresence to animate transitions between routes
    return (
        <div className="min-h-screen bg-black text-white selection:bg-green-500 selection:text-black font-sans overflow-hidden">
            <BackgroundMusic />
            <AnimatePresence mode='wait'>
                <Routes location={location} key={location.pathname}>
                    <Route
                        path="/"
                        element={
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                                <MainPage onStart={() => navigate('/setup')} />
                            </motion.div>
                        }
                    />
                    <Route path="/setup" element={<SetupProfile />} />
                    <Route path="/create" element={<CreateLobby />} />
                    <Route path="/join" element={<JoinLobby />} />
                    <Route path="/lobby" element={<WaitingRoom />} />
                    <Route path="/game" element={<GameLayout />} />
                    {/* Test route with mock data for UI development */}
                    <Route path="/test" element={<MockGameLayout />} />
                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AnimatePresence>
        </div>
    );
};

export default App;