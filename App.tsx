import React from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MainPage } from './components/MainPage';
import { SetupProfile } from './components/lobby_flow/SetupProfile';
import { CreateLobby } from './components/lobby_flow/CreateLobby';
import { JoinLobby } from './components/lobby_flow/JoinLobby';
import { WaitingRoom } from './components/lobby_flow/WaitingRoom';
import { PlayerCard } from './components/PlayerCard';
import { SystemLog } from './components/Narrator';
import { GameControls } from './components/GameControls';
import { useGameContext } from './contexts/GameContext';

const App: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // We use the location as key for AnimatePresence to animate transitions between routes
    return (
        <div className="min-h-screen bg-black text-white selection:bg-green-500 selection:text-black font-sans overflow-hidden">
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
                    <Route path="/game" element={<GameView />} />
                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AnimatePresence>
        </div>
    );
};

// Extracted Game View Component
const GameView: React.FC = () => {
    const {
        gameState,
        handleNextPhase,
        handlePlayerAction,
        canActOnPlayer,
        getActionLabel,
        myPlayer
    } = useGameContext();

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full h-full relative"
        >
            {/* Grid Overlay */}
            <div className="fixed inset-0 pointer-events-none z-[-1] opacity-20"
                style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
            </div>

            <main className="w-full h-screen overflow-y-auto pb-24">
                <SystemLog logs={gameState.logs} />

                {/* Grid of Players */}
                <motion.div
                    layout
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-24 container mx-auto px-4 pt-8"
                >
                    {gameState.players.map((player) => (
                        <PlayerCard
                            key={player.id}
                            player={player}
                            isMe={player.id === gameState.myPlayerId}
                            onAction={handlePlayerAction}
                            canAct={canActOnPlayer(player)}
                            actionLabel={getActionLabel()}
                        />
                    ))}
                </motion.div>
            </main>

            {/* Sticky Controls */}
            <div className="fixed bottom-0 left-0 right-0 z-50 px-4 md:px-8 pb-4">
                <div className="max-w-4xl mx-auto shadow-2xl shadow-black rounded-xl overflow-hidden border border-white/10">
                    <GameControls
                        phase={gameState.phase}
                        myRole={myPlayer?.role || null}
                        dayCount={gameState.dayCount}
                        onNextPhase={handleNextPhase}
                    />
                </div>
            </div>
        </motion.div>
    );
};

export default App;