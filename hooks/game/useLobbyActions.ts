/**
 * useLobbyActions — Create and join lobby on-chain.
 *
 * Handles:
 * - createAndJoin atomic transaction
 * - joinRoom with session key registration
 * - Rejoining existing rooms (session resync)
 * - Tournament room joining
 * - Private room password handling via GM
 * - Avatar upload
 * - ECIES key registration
 */
import { useCallback } from 'react';
import { parseEther, formatEther, parseEventLogs } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { MAFIA_ABI } from '../../contracts/config';
import { generateKeyPair } from '../../services/cryptoUtils';
import { loadSession, createNewSession, storeSession, markSessionRegistered } from '../../services/sessionKeyService';
import { loadOrCreateKeypair } from '../../services/eciesService';
import { signRequest } from '../../services/requestSigning';
import { buildAvatarMessage } from '../../services/signingSchema';
import * as GM from '../../services/gmService';
import { registerSessionOnGm } from '../../services/gmService';
import type { GameRefs } from './useGameRefs';
import type { WalletManager } from './useWalletManager';
import type { TransactionEngine } from './useTransactionEngine';
import type { GameDataSync } from './useGameDataSync';
import type { LogEntry } from '../../types';

interface LobbyDeps {
    refs: GameRefs;
    wallet: WalletManager;
    txEngine: TransactionEngine;
    dataSync: GameDataSync;
    setKeys: (keys: CryptoKeyPair | null) => void;
    setCurrentRoomId: (id: bigint | null) => void;
    setIsTxPending: (v: boolean) => void;
    addLog: (message: string, type?: LogEntry['type']) => void;
}

export function useLobbyActions(deps: LobbyDeps) {
    const { refs, wallet, txEngine, dataSync, setKeys, setCurrentRoomId, setIsTxPending, addLog } = deps;

    // === Helper: Upload avatar to server ===
    const uploadAvatar = useCallback(async (
        roomId: bigint | string,
        myAddr: string,
        avatarUrl: string,
        activeWalletClient: any,
        chainId: number
    ) => {
        try {
            const signed = await signRequest({
                address: myAddr,
                roomId: Number(roomId),
                walletClient: activeWalletClient,
                buildMessage: ({ nonce, timestamp }) => buildAvatarMessage({
                    roomId: roomId.toString(),
                    address: myAddr,
                    nonce,
                    timestamp,
                    chainId,
                }),
            });

            await fetch('/api/game/avatar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: roomId.toString(),
                    address: myAddr,
                    avatar: avatarUrl,
                    signerAddress: signed.signerAddress,
                    nonce: signed.nonce,
                    timestamp: signed.timestamp,
                    chainId,
                })
            });
            console.log('[Avatar Sync] Avatar uploaded to server');
        } catch (e) {
            console.warn('[Avatar Sync] Failed to upload avatar:', e);
        }
    }, []);

    // === CREATE LOBBY ===
    const createLobbyOnChain = useCallback(async (maxPlayers: number = 10, tournamentId: bigint = 0n, nonce?: number): Promise<boolean> => {
        const myAddr = refs.addressRef.current;
        const pClient = refs.publicClientRef.current;
        const targetChain = refs.runtimeChainRef.current;
        const name = refs.playerNameRef.current;
        const lobbyName = refs.lobbyNameRef.current;
        const lobbyPassword = refs.lobbyPasswordRef.current;
        const avatarUrl = refs.avatarUrlRef.current;

        if (!name || !myAddr || !lobbyName || !pClient) { alert("Enter details and connect wallet!"); return false; }
        setIsTxPending(true);
        try {
            const nextId = await pClient.readContract({
                address: refs.contractAddressRef.current,
                abi: MAFIA_ABI,
                functionName: 'nextRoomId',
            }) as bigint;
            const newRoomId = Number(nextId) + 1;

            const keyPair = await generateKeyPair();
            setKeys(keyPair);

            const { sessionAddress, privateKey: sessionPrivKey, session: newSessionObj } = createNewSession(myAddr, newRoomId, targetChain.id, undefined, true);
            const sessionAccount = privateKeyToAccount(sessionPrivKey);
            const pubKeyHex = sessionAccount.publicKey;

            const eciesKp = await loadOrCreateKeypair(newRoomId.toString(), myAddr);
            refs.eciesPrivKeyRef.current = eciesKp.privateKey;

            const safeName = /^[a-zA-Z0-9_ ]+$/.test(name) ? name : `Player_${Math.floor(Math.random() * 1000)}`;
            console.log(`[SafeName] Original: "${name}", Used: "${safeName}"`);

            const { client: activeWalletClient, account: activeAccount } = await wallet.getActiveWalletClient();

            if (!pClient || !targetChain || !myAddr) { alert("Public client or chain/address not ready!"); return false; }

            const txValue = wallet.LOBBY_FUNDING_VALUE;

            // Check balance
            const balance = await pClient.getBalance({ address: myAddr as `0x${string}` });
            if (balance < txValue) {
                const required = formatEther(txValue);
                const current = formatEther(balance);
                alert(`Insufficient balance to fund session. You have ${current} STT but need at least ${required} STT. Please use a Faucet.`);
                setIsTxPending(false);
                return false;
            }

            const gasConfig = await txEngine.getSmartGasConfig({
                functionName: 'createAndJoin',
                args: [lobbyName, maxPlayers, safeName, pubKeyHex as `0x${string}`, sessionAddress as `0x${string}`, !!lobbyPassword, tournamentId],
                account: activeAccount,
                value: txValue,
                nonce,
            });

            const hash = await activeWalletClient.writeContract({
                address: refs.contractAddressRef.current,
                abi: MAFIA_ABI,
                functionName: 'createAndJoin',
                args: [lobbyName, maxPlayers, safeName, pubKeyHex as `0x${string}`, sessionAddress as `0x${string}`, !!lobbyPassword, tournamentId],
                account: activeAccount,
                chain: targetChain,
                value: txValue,
                ...gasConfig
            });

            const receipt = await pClient.waitForTransactionReceipt({ hash });
            if (receipt.status === 'reverted') throw new Error("Transaction reverted on-chain");

            // Extract real roomId from logs
            let finalRoomId = BigInt(newRoomId);
            try {
                const logs = parseEventLogs({
                    abi: MAFIA_ABI,
                    eventName: 'RoomCreated',
                    logs: receipt.logs
                });
                if (logs.length > 0) {
                    finalRoomId = (logs[0] as any).args.roomId;
                    console.log(`[Create] Extracted actual roomId from log: ${finalRoomId}`);
                }
            } catch (e) {
                console.warn("[Create] Failed to parse RoomCreated log", e);
            }

            // Activate session
            newSessionObj.roomId = Number(finalRoomId);
            newSessionObj.registeredOnChain = true;
            storeSession(newSessionObj);
            markSessionRegistered();

            // Non-blocking GM sync has been removed to prevent double MetaMask popup.
            // The GM Server will automatically fetch the session key from the blockchain on the first signature verification.
            /*
            registerSessionOnGm({
                roomId: finalRoomId.toString(),
                mainWallet: myAddr,
                sessionAddress: newSessionObj.address,
                walletClient: activeWalletClient,
                chainId: targetChain.id
            }).catch(e => console.warn("[Create] GM session registration failed:", e));
            */

            if (lobbyPassword) {
                GM.setRoomPassword({
                    roomId: finalRoomId.toString(),
                    address: myAddr,
                    password: lobbyPassword,
                    walletClient: activeWalletClient,
                    signerAddress: myAddr,
                    chainId: targetChain.id,
                    maxPlayers: maxPlayers
                }).catch(e => console.warn("[Create] GM password sync failed:", e));
            }

            // Register ECIES pubkey
            setTimeout(() => {
                GM.registerEciesPubkey(finalRoomId.toString(), myAddr, activeWalletClient, targetChain.id)
                    .then(kp => { refs.eciesPrivKeyRef.current = kp.privateKey; })
                    .catch(e => console.warn('[ECIES] GM registration failed:', e));
            }, 1000);

            setCurrentRoomId(finalRoomId);
            dataSync.refreshPlayersList(finalRoomId).catch(console.error);

            // Upload avatar
            if (avatarUrl && myAddr) {
                uploadAvatar(finalRoomId, myAddr, avatarUrl, activeWalletClient, targetChain.id);
            }

            addLog("Lobby created successfully!", "success");
            setIsTxPending(false);
            return true;
        } catch (e: any) {
            console.error(e);
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
            return false;
        }
    }, [refs, wallet, txEngine, dataSync, setKeys, setCurrentRoomId, setIsTxPending, addLog, uploadAvatar]);

    // === JOIN LOBBY ===
    const joinLobbyOnChain = useCallback(async (roomId: bigint | number, passwordOverride?: string): Promise<boolean> => {
        const pClient = refs.publicClientRef.current;
        const targetChain = refs.runtimeChainRef.current;
        const myAddr = refs.addressRef.current;
        const name = refs.playerNameRef.current;
        const lobbyPassword = passwordOverride ?? refs.lobbyPasswordRef.current;
        const avatarUrl = refs.avatarUrlRef.current;

        if (!name || !myAddr || !pClient || !targetChain) { alert("Connect wallet and set name first!"); return false; }

        const rId = BigInt(roomId);
        setIsTxPending(true);
        try {
            const { client: activeWalletClient, account: activeAccount } = await wallet.getActiveWalletClient();

            const safeName = /^[a-zA-Z0-9_ ]+$/.test(name) ? name : `Player_${Math.floor(Math.random() * 1000)}`;
            console.log(`[SafeName] Join - Original: "${name}", Used: "${safeName}"`);

            // 0. Check abandonment
            const abandoned = JSON.parse(localStorage.getItem('mafia_abandoned_rooms') || '[]');
            if (abandoned.includes(rId.toString())) {
                addLog("You have already left this game session and cannot rejoin.", "danger");
                return false;
            }

            // 1. Check if already in room
            let isJoined = false;
            try {
                const currentPlayers = await pClient.readContract({
                    address: refs.contractAddressRef.current,
                    abi: MAFIA_ABI,
                    functionName: 'getPlayers',
                    args: [rId],
                }) as any[];
                isJoined = currentPlayers.some((p: any) => (p.wallet || p[0]).toLowerCase() === myAddr.toLowerCase());
            } catch (e) {
                console.warn("[Join] Failed to verify if player is already joined:", e);
            }

            if (isJoined) {
                console.log("[Join] Already in room on-chain. Syncing session and verifying on-chain status...");

                let currentSession = loadSession();
                const sessionMatches = currentSession &&
                    currentSession.roomId === Number(roomId) &&
                    currentSession.mainWallet.toLowerCase() === myAddr.toLowerCase();

                let onChainSessionSynced = false;
                try {
                    const onChainData = await pClient.readContract({
                        address: refs.contractAddressRef.current,
                        abi: MAFIA_ABI,
                        functionName: 'sessionKeys',
                        args: [myAddr as `0x${string}`],
                    }) as any;

                    if (onChainData && currentSession) {
                        const onChainAddr = (Array.isArray(onChainData) ? onChainData[0] : onChainData.sessionAddress).toLowerCase();
                        const onChainRoomId = (Array.isArray(onChainData) ? onChainData[2] : onChainData.roomId).toString();

                        onChainSessionSynced = onChainAddr === currentSession.address.toLowerCase() &&
                            onChainRoomId === rId.toString() &&
                            (Array.isArray(onChainData) ? onChainData[3] : onChainData.isActive);

                        if (!onChainSessionSynced) {
                            console.log(`[Join] Session mismatch! Local: ${currentSession.address}, On-Chain: ${onChainAddr}. Forcing resync...`);
                        }
                    }
                } catch (e) {
                    console.warn("[Join] Failed to verify on-chain sessionKey data:", e);
                }

                if (!sessionMatches || !currentSession?.registeredOnChain || !onChainSessionSynced) {
                    if (!sessionMatches) {
                        console.log("[Join] No valid session for this room locally. Creating a new one for auto-signing...");
                        const sessionRes = createNewSession(myAddr, Number(roomId), targetChain.id, undefined, true);
                        currentSession = sessionRes.session;
                    }

                    if (currentSession) {
                        try {
                            const { client: walletClient, account: walletAccount } = await wallet.getActiveWalletClient();

                            const balance = await pClient.getBalance({ address: myAddr as `0x${string}` });
                            if (balance < wallet.LOBBY_FUNDING_VALUE) {
                                alert(`Insufficient balance to re-sync session. You need at least ${formatEther(wallet.LOBBY_FUNDING_VALUE)} STT.`);
                                return false;
                            }

                            const txHash = await walletClient.writeContract({
                                address: refs.contractAddressRef.current,
                                abi: MAFIA_ABI,
                                functionName: 'registerSessionKey',
                                args: [BigInt(rId), currentSession.address as `0x${string}`],
                                chain: targetChain,
                                account: walletAccount,
                                value: wallet.LOBBY_FUNDING_VALUE
                            });
                            console.log(`[Join] Session re-registered/funded on-chain: ${txHash}`);

                            await pClient.waitForTransactionReceipt({ hash: txHash });

                            storeSession(currentSession);
                            markSessionRegistered();

                            // GM sync removed to eliminate double MetaMask popup.
                            /*
                            await registerSessionOnGm({
                                roomId: rId.toString(),
                                mainWallet: myAddr,
                                sessionAddress: currentSession.address,
                                walletClient: walletClient,
                                chainId: targetChain.id
                            });
                            */
                            console.log("[Join] Session cached locally ✅");
                        } catch (e) {
                            console.warn("[Join] Failed to register/fund session key during sync:", e);
                        }
                    }
                } else {
                    console.log("[Join] Valid registered session already exists and is synced. Skipping transaction.");
                }

                setCurrentRoomId(rId);
                await dataSync.refreshPlayersList(rId);
                return true;
            }

            // 2. Generate/Load Session
            const existing = loadSession();
            let sessionAddress: `0x${string}`;
            let sessionPrivKey: `0x${string}`;
            let newSessionObj: any = null;

            if (existing && existing.roomId === Number(roomId) && existing.mainWallet.toLowerCase() === myAddr.toLowerCase()) {
                sessionAddress = existing.address;
                sessionPrivKey = existing.privateKey;
                console.log("[Lobby] Reusing existing session key for join");
            } else {
                const sessionRes = createNewSession(myAddr, Number(roomId), targetChain.id, undefined, true);
                sessionAddress = sessionRes.sessionAddress;
                sessionPrivKey = sessionRes.privateKey;
                newSessionObj = sessionRes.session;
                console.log("[Lobby] Generating new session key for join");
            }

            // 3. Generate crypto keys
            const keyPair = await generateKeyPair();
            setKeys(keyPair);

            const sessionAccount = privateKeyToAccount(sessionPrivKey);
            const pubKeyHex = sessionAccount.publicKey;

            const eciesKp = await loadOrCreateKeypair(roomId.toString(), myAddr);
            refs.eciesPrivKeyRef.current = eciesKp.privateKey;

            // 3. Check if room is private
            let roomData: any = null;
            let gmSignature: `0x${string}` = '0x';
            try {
                roomData = await pClient.readContract({
                    address: refs.contractAddressRef.current,
                    abi: MAFIA_ABI,
                    functionName: 'getRoom',
                    args: [BigInt(roomId)],
                }) as any;

                const isPrivate = Array.isArray(roomData) ? Boolean(roomData[18]) : Boolean(roomData.isPrivate);
                if (roomData && isPrivate) {
                    if (!lobbyPassword) {
                        alert("This room is private. Please enter the password.");
                        return false;
                    }
                    addLog("Requesting join permit (private room)...", "info");
                    gmSignature = await GM.requestJoinPermit({
                        roomId: roomId.toString(),
                        password: lobbyPassword,
                        playerAddress: myAddr,
                        chainId: targetChain.id,
                    });
                    addLog("Join permit received ✅", "success");
                }
            } catch (e: any) {
                console.error("[Join] Error checking room privacy or tournament:", e);
                addLog(`Join permit failed: ${e.message}`, "danger");

                const isPrivateData = Array.isArray(roomData) ? Boolean(roomData[18]) : Boolean(roomData?.isPrivate);
                if (roomData && isPrivateData) {
                    alert(`Failed to get join permit: ${e.message}`);
                    return false;
                }
            }

            // 3.1. Tournament check
            const tournamentIdFromRoom = Array.isArray(roomData) ? BigInt(roomData[19] || 0) : BigInt(roomData?.tournamentId || 0);
            const isTournamentRoom = roomData ? tournamentIdFromRoom > 0n : false;

            let needsTournamentJoin = false;
            let tournamentValueRequired = 0n;

            if (isTournamentRoom) {
                try {
                    const tournamentResult = await pClient.readContract({
                        address: refs.contractAddressRef.current,
                        abi: MAFIA_ABI,
                        functionName: 'getTournament',
                        args: [tournamentIdFromRoom],
                    }) as any;

                    const buyIn = Array.isArray(tournamentResult) ? BigInt(tournamentResult[3] || 0) : BigInt(tournamentResult.buyIn || 0);
                    const sessionFee = Array.isArray(tournamentResult) ? BigInt(tournamentResult[5] || 0) : BigInt(tournamentResult.sessionFee || 0);

                    if (tournamentResult) {
                        const isPart = await pClient.readContract({
                            address: refs.contractAddressRef.current,
                            abi: MAFIA_ABI,
                            functionName: 'isTournamentParticipant',
                            args: [tournamentIdFromRoom, myAddr as `0x${string}`],
                        }) as boolean;
                        if (!isPart) {
                            needsTournamentJoin = true;
                            tournamentValueRequired = buyIn + sessionFee;
                        }
                    }
                } catch (e: any) {
                    console.error("[Join] Participation check failed:", e);
                }
            }

            const txValue = needsTournamentJoin ? tournamentValueRequired : (isTournamentRoom ? 0n : wallet.LOBBY_FUNDING_VALUE);

            if (txValue > 0n) {
                const balance = await pClient.getBalance({ address: myAddr as `0x${string}` });
                if (balance < txValue) {
                    const required = formatEther(txValue);
                    const current = formatEther(balance);
                    alert(`Insufficient balance. You need at least ${required} STT to join and fund your session. You have ${current} STT.`);
                    return false;
                }
            }

            const fnName = needsTournamentJoin ? 'joinTournamentAndRoom' : 'joinRoom';
            const callArgs = needsTournamentJoin
                ? [tournamentIdFromRoom, "", BigInt(roomId), safeName, pubKeyHex as `0x${string}`, sessionAddress as `0x${string}`, gmSignature]
                : [BigInt(roomId), safeName, pubKeyHex as `0x${string}`, sessionAddress as `0x${string}`, gmSignature];

            console.log(`[Join] Tournament status: ${isTournamentRoom}, needsJoin: ${needsTournamentJoin}, sending value: ${txValue}`);
            addLog(needsTournamentJoin
                ? `Joining tournament #${tournamentIdFromRoom} and room simultaneously...`
                : "Joining room...", "info");

            const gasConfig = await txEngine.getSmartGasConfig({
                functionName: fnName,
                args: callArgs,
                account: activeAccount as `0x${string}`,
                value: txValue,
            });

            const hash = await activeWalletClient.writeContract({
                address: refs.contractAddressRef.current,
                abi: MAFIA_ABI,
                functionName: fnName,
                args: callArgs,
                account: activeAccount,
                chain: targetChain,
                value: txValue,
                ...gasConfig
            });

            const joinReceipt = await pClient.waitForTransactionReceipt({ hash });
            if (joinReceipt.status === 'reverted') throw new Error("Transaction reverted on-chain");

            if (newSessionObj) {
                storeSession(newSessionObj);
            }
            markSessionRegistered();

            // Debug deposit
            try {
                const depositLogs = parseEventLogs({
                    abi: MAFIA_ABI,
                    eventName: 'DepositCollected',
                    logs: joinReceipt.logs
                });
                if (depositLogs.length > 0) {
                    const depArgs = (depositLogs[0] as any).args;
                    console.log(`[Deposit Debug] joinRoom DepositCollected:`, {
                        player: depArgs.player,
                        amount: formatEther(depArgs.amount) + ' STT',
                    });
                } else {
                    console.log(`[Deposit Debug] No DepositCollected in joinRoom receipt.`);
                }
            } catch (e) {
                console.warn('[Deposit Debug] Could not parse join deposit events:', e);
            }

            markSessionRegistered();

            // GM sync removed to eliminate double MetaMask popup.
            /*
            if (sessionAddress) {
                try {
                    const { client: activeWalletClient } = await wallet.getActiveWalletClient();
                    await registerSessionOnGm({
                        roomId: roomId.toString(),
                        mainWallet: myAddr,
                        sessionAddress,
                        walletClient: activeWalletClient,
                        chainId: targetChain.id
                    });
                    console.log("[Lobby] Session registered on GM after join ✅");
                } catch (e) {
                    console.warn("[Lobby] Could not sync session to GM server:", e);
                }
            }
            */

            // Register ECIES pubkey
            setTimeout(async () => {
                try {
                    const kp = await GM.registerEciesPubkey(roomId.toString(), myAddr, activeWalletClient, targetChain.id);
                    refs.eciesPrivKeyRef.current = kp.privateKey;
                    console.log('[ECIES] Public key registered and ref updated ✅');
                } catch (e) {
                    console.warn('[ECIES] Failed to register pubkey with GM (non-blocking):', e);
                }
            }, 1500);

            setCurrentRoomId(BigInt(roomId));
            await dataSync.refreshPlayersList(BigInt(roomId));

            // Upload avatar
            if (avatarUrl && myAddr) {
                uploadAvatar(BigInt(roomId), myAddr, avatarUrl, activeWalletClient, targetChain.id);
            }

            return true;
        } catch (e: any) {
            console.error(e);
            addLog(e.shortMessage || e.message, "danger");
            return false;
        } finally {
            setIsTxPending(false);
        }
    }, [refs, wallet, txEngine, dataSync, setKeys, setCurrentRoomId, setIsTxPending, addLog, uploadAvatar]);

    return {
        createLobbyOnChain,
        joinLobbyOnChain,
    };
}

export type LobbyActions = ReturnType<typeof useLobbyActions>;
