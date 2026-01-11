import React from 'react';
import lobbyBg from '../assets/lobby_background.png';

interface LobbyProps {
    onStart: () => void;
    connectedPlayers?: { name: string; address: string }[];
}

export const Lobby: React.FC<LobbyProps> = ({ onStart, connectedPlayers = [] }) => {
    // Fill with mock data if empty, to match the design screenshot potential
    const players = connectedPlayers.length > 0 ? connectedPlayers : Array(8).fill({ name: 'Haiman', address: '0x9c...4b5e' });

    return (
        <div className="relative w-full h-screen overflow-hidden bg-[#5A371E] flex items-center justify-center font-['Montserrat']">
            {/* Background Image */}
            <img
                src={lobbyBg}
                alt="Lobby Background"
                className="absolute inset-0 w-full h-full object-cover blur-[5px]"
                style={{ boxShadow: '10px 10px 10px rgba(0,0,0,0.5)' }}
            />

            {/* Main Container - Scaled to fit screen if needed, but keeping aspect ratio or centering */}
            <div className="relative w-[1488px] h-[1024px] scale-[0.6] md:scale-[0.8] lg:scale-100 origin-center transition-transform duration-300">

                {/* Top Card (Profile?) */}
                <div
                    className="absolute left-[444px] top-[134px] w-[600px] h-[300px] bg-[rgba(40,22,8,0.70)] rounded-[42px]"
                />

                {/* Avatar Circle */}
                <div
                    className="absolute left-[668px] top-[147px] w-[150px] h-[150px] bg-[rgba(25,19,13,0.88)] rounded-full border border-black"
                />

                {/* Name Box */}
                <div
                    className="absolute left-[644px] top-[307px] w-[200px] h-[30px] bg-[rgba(25,19,13,0.43)] rounded-[5px] border border-black"
                />

                {/* Name Text */}
                <div className="absolute left-[705px] top-[302px] w-[78px] h-[38px] flex items-center justify-center">
                    <span className="text-[rgba(255,255,255,0.38)] text-[32px] font-['Playfair_Display'] font-normal">Name</span>
                </div>

                {/* Connect Button */}
                <div className="absolute left-[760px] top-[371px] w-[243px] h-[46px] bg-[#19130D] rounded-[10px] cursor-pointer hover:bg-[#2a2016] transition-colors" />
                <span className="absolute left-[779px] top-[379px] text-[rgba(255,255,255,0.76)] text-[24px] font-normal pointer-events-none">Connect to lobby</span>

                {/* Create Game Button */}
                <div className="absolute left-[485px] top-[371px] w-[243px] h-[46px] bg-[#916A47] rounded-[10px] cursor-pointer hover:bg-[#a37853] transition-colors" />
                <span className="absolute left-[531px] top-[379px] text-[rgba(255,255,255,0.76)] text-[24px] font-normal pointer-events-none">Create game</span>


                {/* Players List Container */}
                <div
                    className="absolute left-[397px] top-[488px] w-[692px] h-[496px] bg-[rgba(34,22,11,0.70)] rounded-[20px]"
                />

                {/* Player Header/Label (Haiman Lobby?) */}
                <div className="absolute left-[655px] top-[512px] w-[177px] h-[36px] text-white text-[24px] font-normal">
                    Haiman lobby
                </div>

                {/* Scrollbar Track/Thumb Mockup */}
                <div className="absolute left-[1079px] top-[563px] w-[5px] h-[152px] bg-[#916A47] rounded-[2px]" />

                {/* Player Rows */}
                {players.slice(0, 8).map((player, index) => (
                    <div
                        key={index}
                        className="absolute left-[443px] w-[600px] h-[30px] px-3 py-[5px] bg-[rgba(25,19,13,0.75)] rounded-[2px] flex justify-between items-start"
                        style={{ top: `${563 + (index * 40)}px` }}
                    >
                        <span className="text-white text-[16px] font-normal">{player.name}</span>
                        <span className="w-[94px] h-[16px] text-white text-[16px] font-normal">{player.address}</span>
                    </div>
                ))}

                {/* Start Game Button */}
                <div
                    onClick={onStart}
                    className="absolute left-[621px] top-[914px] w-[243px] h-[46px] bg-[#19130D] rounded-[10px] cursor-pointer hover:bg-[#2a2016] transition-colors flex items-center justify-center"
                >
                    <span className="text-[rgba(255,255,255,0.76)] text-[24px] font-normal">Start the game</span>
                </div>

                {/* Counter */}
                <div className="absolute left-[726px] top-[962px] w-[33px] h-[14px] text-white text-[16px] font-normal">
                    0/16
                </div>

            </div>
        </div>
    );
};
