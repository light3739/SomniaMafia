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
import { useNoirDialog } from '../../contexts/NoirDialogContext';
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
import { checkAfkCooldown, formatCooldown } from '../../services/cooldownCheck';
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
    const { showAlert } = useNoirDialog();

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
        const pClient = refs.publicClientRef.current;
        const targetChain = refs.runtimeChainRef.current;
        const name = refs.playerNameRef.current;
        const lobbyName = refs.lobbyNameRef.current;
        const lobbyPassword = refs.lobbyPasswordRef.current;
        const avatarUrl = refs.avatarUrlRef.current;

        if (!name || !lobbyName || !pClient || !targetChain) { await showAlert("Enter details and connect wallet!"); return false; }
        setIsTxPending(true);
        try {
            // Acquire wallet FIRST so we have the canonical signing address before
            // we touch the session/ECIES storage. On a cold start with a locked
            // external wallet, refs.addressRef can hold a stale (e.g. Privy
            // embedded) address while the actual signer is a freshly-unlocked
            // MetaMask account — using that stale address would persist a
            // session keyed by the wrong wallet and force a second pubkey popup
            // in WaitingRoom. See useWalletManager.getActiveWalletClient where
            // refs.addressRef.current can be overwritten during unlock.
            const { client: activeWalletClient, account: activeAccount } = await wallet.getActiveWalletClient();
            const activeAddr = (typeof activeAccount === 'string' ? activeAccount : (activeAccount as any)?.address) as `0x${string}` | undefined;
            if (!activeAddr) { await showAlert("Wallet not ready. Please unlock and try again."); setIsTxPending(false); return false; }
            const myAddr = activeAddr.toLowerCase() as `0x${string}`;
            // Keep refs in sync so any concurrent reader (WaitingRoom polling,
            // useGameDataSync, etc.) sees the same canonical address.
            refs.addressRef.current = myAddr;

            // AFK cooldown preflight: if the wallet was kicked for inactivity in
            // a previous game, show a clear message instead of a generic tx revert.
            const cooldown = await checkAfkCooldown(pClient as any, refs.contractAddressRef.current, myAddr);
            if (cooldown.blocked) {
                await showAlert(
                    `You were kicked for inactivity in a previous game. Access returns in ${formatCooldown(cooldown.remaining)}.`,
                    { variant: 'danger', title: 'AFK Cooldown' }
                );
                setIsTxPending(false);
                return false;
            }

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

            // ECIES keypair is created AFTER finalRoomId is known (below) so the
            // localStorage entry is keyed by the real on-chain room id, not the
            // optimistic newRoomId — those can diverge if another room was
            // created between our nextRoomId read and our tx landing.

            const safeName = /^[a-zA-Z0-9_ ]+$/.test(name) ? name : `Player_${Math.floor(Math.random() * 1000)}`;
            console.log(`[SafeName] Original: "${name}", Used: "${safeName}"`);

            const txValue = wallet.LOBBY_FUNDING_VALUE;

            // Check balance
            const balance = await pClient.getBalance({ address: myAddr as `0x${string}` });
            if (balance < txValue) {
                const required = formatEther(txValue);
                const current = formatEther(balance);
                await showAlert(`Insufficient balance to fund session. You have ${current} STT but need at least ${required} STT. Please use a Faucet.`, { variant: 'danger', title: 'Insufficient Balance' });
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

            // Now that the real roomId is known and the session is in storage,
            // create the ECIES keypair under the canonical key and register the
            // pubkey with the GM server. We do it HERE — not in WaitingRoom —
            // because we still hold the canonical signer (myAddr) and the
            // walletClient that just signed the createAndJoin tx. The matching
            // session row in localStorage means signRequest will sign with the
            // session key (no wallet popup).
            //
            // Doing this in WaitingRoom is racy: useAccount()/useWalletClient()
            // can briefly return a different wallet (Privy embedded vs main)
            // during /create→/waiting navigation, which both pops the wrong
            // wallet AND breaks the session check in useSessionKey.
            try {
                const eciesKp = await loadOrCreateKeypair(finalRoomId.toString(), myAddr);
                refs.eciesPrivKeyRef.current = eciesKp.privateKey;
            } catch (e) {
                console.warn('[Create] Failed to create ECIES keypair:', e);
            }

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
                const activeAddress = (activeAccount as any)?.address || activeAccount || myAddr;
                let passwordSynced = false;
                let lastPasswordErr: any;
                for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                        // Sign with the session key (forceWallet removed). The
                        // session row was just stored above so signRequest will
                        // pick it up. GM's verifyAuthorizedSignature handles
                        // session-key signatures for the host check (it checks
                        // hostAddress against on-chain room.host, not the signer).
                        //
                        // Forcing wallet here used to mount Privy's transaction
                        // confirmation modal on embedded-wallet flows. That modal
                        // contains a buggy useGetTokenPrice path that throws
                        // React error #300 ("Rendered fewer hooks than expected")
                        // when the Somnia STT price 404s on auth.privy.io —
                        // which is exactly why this error only appeared on
                        // password lobbies + Privy embedded.
                        await GM.setRoomPassword({
                            roomId: finalRoomId.toString(),
                            address: activeAddress,
                            password: lobbyPassword,
                            walletClient: activeWalletClient,
                            chainId: targetChain.id,
                            maxPlayers: maxPlayers
                        });
                        passwordSynced = true;
                        break;
                    } catch (e) {
                        lastPasswordErr = e;
                        console.warn(`[Create] GM password sync attempt ${attempt + 1} failed:`, e);
                        if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
                    }
                }
                if (!passwordSynced) {
                    console.error("[Create] GM password sync failed after 3 attempts:", lastPasswordErr);
                    addLog("Room created, but password sync failed — players won't be able to join. Try recreating the room.", "danger");
                    await showAlert(`Room created but password could not be set on GM server: ${lastPasswordErr?.message || 'Unknown error'}. The room is private but inaccessible. Please recreate it.`, { variant: 'danger', title: 'Password Sync Failed' });
                    setIsTxPending(false);
                    return false;
                }
            }

            setCurrentRoomId(finalRoomId);
            // Don't call refreshPlayersList here — setCurrentRoomId triggers a
            // useEffect that resets gameState to INITIAL, which would race with
            // the data we fetch and potentially wipe it. The continuous polling in
            // useGameDataSync will pick up the new room automatically.

            // Upload avatar
            if (avatarUrl && myAddr) {
                uploadAvatar(finalRoomId, myAddr, avatarUrl, activeWalletClient, targetChain.id);
            }

            // Register ECIES pubkey with GM server. Fire-and-forget so the user
            // isn't blocked on a slow GM round-trip; signRequest will use the
            // session key we just stored above (no wallet popup). On failure
            // WaitingRoom's fallback effect can retry on mount.
            GM.registerEciesPubkey(finalRoomId.toString(), myAddr, activeWalletClient, targetChain.id)
                .then(() => console.log('[Create] ECIES pubkey registered with GM ✅'))
                .catch(e => console.warn('[Create] ECIES register failed (WaitingRoom may retry):', e));

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
        const name = refs.playerNameRef.current;
        const lobbyPassword = passwordOverride ?? refs.lobbyPasswordRef.current;
        const avatarUrl = refs.avatarUrlRef.current;

        if (!name || !pClient || !targetChain) { await showAlert("Connect wallet and set name first!"); return false; }

        const rId = BigInt(roomId);
        setIsTxPending(true);
        try {
            // Acquire wallet FIRST and derive the canonical address from the
            // signer that will actually sign the join tx. See createLobbyOnChain
            // for the rationale — on cold-start with a locked external wallet,
            // refs.addressRef can hold a stale embedded address while the real
            // signer is the freshly-unlocked MetaMask, which would otherwise
            // persist a session under the wrong key and force a second pubkey
            // popup in WaitingRoom.
            const { client: activeWalletClient, account: activeAccount } = await wallet.getActiveWalletClient();
            const activeAddr = (typeof activeAccount === 'string' ? activeAccount : (activeAccount as any)?.address) as `0x${string}` | undefined;
            if (!activeAddr) { await showAlert("Wallet not ready. Please unlock and try again."); setIsTxPending(false); return false; }
            const myAddr = activeAddr.toLowerCase() as `0x${string}`;
            refs.addressRef.current = myAddr;

            // AFK cooldown preflight — surface a clear message instead of the
            // generic Unauthorized() revert from requireNotAfkBlocked.
            const cooldown = await checkAfkCooldown(pClient as any, refs.contractAddressRef.current, myAddr);
            if (cooldown.blocked) {
                await showAlert(
                    `You were kicked for inactivity in a previous game. Access returns in ${formatCooldown(cooldown.remaining)}.`,
                    { variant: 'danger', title: 'AFK Cooldown' }
                );
                setIsTxPending(false);
                return false;
            }

            const safeName = /^[a-zA-Z0-9_ ]+$/.test(name) ? name : `Player_${Math.floor(Math.random() * 1000)}`;
            console.log(`[SafeName] Join - Original: "${name}", Used: "${safeName}"`);

            // 0. Check abandonment
            const abandoned = JSON.parse(localStorage.getItem('mafia_abandoned_rooms') || '[]');
            if (abandoned.includes(rId.toString())) {
                addLog("You have already left this game session and cannot rejoin.", "danger");
                return false;
            }

            // 1. Check if already in room (must be active — forfeited players have FLAG_ACTIVE cleared)
            let isJoined = false;
            try {
                const FLAG_ACTIVE = 2;
                const currentPlayers = await pClient.readContract({
                    address: refs.contractAddressRef.current,
                    abi: MAFIA_ABI,
                    functionName: 'getPlayers',
                    args: [rId],
                }) as any[];
                isJoined = currentPlayers.some((p: any) => {
                    const wallet = (p.wallet || p[0]).toLowerCase();
                    const flags = Number(p.flags ?? p[3] ?? 0);
                    return wallet === myAddr.toLowerCase() && (flags & FLAG_ACTIVE) !== 0;
                });
            } catch (e) {
                console.warn("[Join] Failed to verify if player is already joined:", e);
            }

            if (isJoined) {
                console.log("[Join] Already in room on-chain. Syncing session and verifying on-chain status...");

                let currentSession = loadSession();
                const sessionMatches = currentSession &&
                    currentSession.roomId === Number(roomId) &&
                    currentSession.mainWallet.toLowerCase() === myAddr.toLowerCase();

                // Tri-state on-chain verification:
                //  - 'matches'    : on-chain sessionKeys returned data that matches our local key
                //  - 'mismatch'   : on-chain returned a different key — must re-register
                //  - 'unknown'    : RPC failed or returned empty struct — DON'T force a wallet
                //                   popup if our local cache already says registeredOnChain.
                //                   This avoids the cold-cache "phantom re-registration" tx.
                let onChainCheck: 'matches' | 'mismatch' | 'unknown' = 'unknown';
                try {
                    const onChainData = await pClient.readContract({
                        address: refs.contractAddressRef.current,
                        abi: MAFIA_ABI,
                        functionName: 'sessionKeys',
                        args: [myAddr as `0x${string}`],
                    }) as any;

                    if (onChainData && currentSession) {
                        const rawAddr = Array.isArray(onChainData) ? onChainData[0] : onChainData.sessionAddress;
                        const onChainAddr = String(rawAddr || '').toLowerCase();
                        const onChainRoomId = (Array.isArray(onChainData) ? onChainData[2] : onChainData.roomId)?.toString() ?? '0';
                        const isActive = Array.isArray(onChainData) ? onChainData[3] : onChainData.isActive;

                        // Empty / unset session struct → treat as unknown, not a definitive mismatch.
                        const isEmpty = !onChainAddr || onChainAddr === '0x0000000000000000000000000000000000000000';

                        if (isEmpty) {
                            onChainCheck = 'unknown';
                        } else if (
                            onChainAddr === currentSession.address.toLowerCase() &&
                            onChainRoomId === rId.toString() &&
                            isActive
                        ) {
                            onChainCheck = 'matches';
                        } else {
                            onChainCheck = 'mismatch';
                            console.log(`[Join] Session mismatch! Local: ${currentSession.address}, On-Chain: ${onChainAddr}. Forcing resync...`);
                        }
                    }
                } catch (e) {
                    console.warn("[Join] Failed to verify on-chain sessionKey data (will trust local cache):", e);
                    onChainCheck = 'unknown';
                }

                // Decide whether we actually need to re-register:
                //  - No matching local session → must register
                //  - Local session exists but flag not set → must register
                //  - On-chain says definitively mismatched → must re-register
                //  - On-chain unknown but local cache says registered → trust it, skip
                const needsRegister =
                    !sessionMatches ||
                    !currentSession?.registeredOnChain ||
                    onChainCheck === 'mismatch';

                if (needsRegister) {
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
                                await showAlert(`Insufficient balance to re-sync session. You need at least ${formatEther(wallet.LOBBY_FUNDING_VALUE)} STT.`, { variant: 'danger', title: 'Insufficient Balance' });
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
                } else if (onChainCheck === 'unknown') {
                    console.log("[Join] On-chain check inconclusive — trusting locally cached session, skipping transaction.");
                } else {
                    console.log("[Join] Valid registered session already exists and is synced. Skipping transaction.");
                }

                // Ensure ECIES keypair exists locally and pubkey is registered
                // with GM. Done here so WaitingRoom never has to read wagmi
                // address/walletClient mid-navigation (which races between
                // Privy embedded and main wallet). Fire-and-forget — signRequest
                // uses the session key, so no wallet popup.
                try {
                    const eciesKp = await loadOrCreateKeypair(rId.toString(), myAddr);
                    refs.eciesPrivKeyRef.current = eciesKp.privateKey;
                } catch (e) {
                    console.warn('[Join Rejoin] Failed to create ECIES keypair:', e);
                }
                GM.registerEciesPubkey(rId.toString(), myAddr, activeWalletClient, targetChain.id)
                    .then(() => console.log('[Join Rejoin] ECIES pubkey registered with GM ✅'))
                    .catch(e => console.warn('[Join Rejoin] ECIES register failed (WaitingRoom may retry):', e));

                setCurrentRoomId(rId);
                // Polling in useGameDataSync will auto-fetch player data.
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
                        await showAlert("This room is private. Please enter the password.", { title: 'Private Room' });
                        return false;
                    }
                    addLog("Requesting join permit (private room)...", "info");
                    gmSignature = await GM.requestJoinPermit({
                        roomId: roomId.toString(),
                        password: lobbyPassword,
                        playerAddress: (activeAccount as any)?.address || activeAccount || myAddr,
                        chainId: targetChain.id,
                    });
                    addLog("Join permit received ✅", "success");
                }
            } catch (e: any) {
                console.error("[Join] Error checking room privacy or tournament:", e);
                addLog(`Join permit failed: ${e.message}`, "danger");

                const isPrivateData = Array.isArray(roomData) ? Boolean(roomData[18]) : Boolean(roomData?.isPrivate);
                if (roomData && isPrivateData) {
                    await showAlert(`Failed to get join permit: ${e.message}`, { variant: 'danger', title: 'Join Failed' });
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
                    await showAlert(`Insufficient balance. You need at least ${required} STT to join and fund your session. You have ${current} STT.`, { variant: 'danger', title: 'Insufficient Balance' });
                    return false;
                }
            }

            const fnName = needsTournamentJoin ? 'joinTournamentAndRoom' : 'joinRoom';
            const callArgs = needsTournamentJoin
                ? [tournamentIdFromRoom, lobbyPassword || "", BigInt(roomId), safeName, pubKeyHex as `0x${string}`, sessionAddress as `0x${string}`, gmSignature]
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

            setCurrentRoomId(BigInt(roomId));
            // Polling in useGameDataSync will auto-fetch player data for the new room.

            // Upload avatar
            if (avatarUrl && myAddr) {
                uploadAvatar(BigInt(roomId), myAddr, avatarUrl, activeWalletClient, targetChain.id);
            }

            // Register ECIES pubkey with GM server. Done here (not in
            // WaitingRoom) so the canonical signer + walletClient that just
            // signed joinRoom is what GM sees — eliminates the wagmi/Privy
            // race that pops the wrong wallet during navigation. Fire-and-
            // forget; signRequest uses the session key we just stored, so
            // there's no wallet popup.
            GM.registerEciesPubkey(BigInt(roomId).toString(), myAddr, activeWalletClient, targetChain.id)
                .then(() => console.log('[Join] ECIES pubkey registered with GM ✅'))
                .catch(e => console.warn('[Join] ECIES register failed (WaitingRoom may retry):', e));

            return true;
        } catch (e: any) {
            console.error(e);
            addLog(e.shortMessage || e.message, "danger");
            return false;
        } finally {
            setIsTxPending(false);
        }
    }, [refs, wallet, txEngine, dataSync, setKeys, setCurrentRoomId, setIsTxPending, addLog, uploadAvatar]);

    // === FORFEIT (LEAVE LOBBY / GAME) ===
    const forfeitGameOnChain = useCallback(async (): Promise<boolean> => {
        const roomId = refs.currentRoomIdRef.current;
        if (!roomId) { addLog("No active room to leave", "danger"); return false; }

        setIsTxPending(true);
        try {
            const targetChain = refs.runtimeChainRef.current;
            const pClient = refs.publicClientRef.current!;

            // Try to use session wallet — it can drain its own balance via msg.value,
            // and resolvePlayer() in the contract maps session → main wallet.
            const sessionClient = wallet.getSessionWalletClient();
            if (sessionClient) {
                const sessionAddr = sessionClient.account!.address;
                const bal = await pClient.getBalance({ address: sessionAddr });

                // Estimate gas cost first, then forward whatever remains
                let gasEstimate = 300000n;
                try {
                    gasEstimate = await pClient.estimateGas({
                        account: sessionAddr,
                        to: refs.contractAddressRef.current,
                        data: '0x98be22f7' + roomId.toString(16).padStart(64, '0') as `0x${string}`,
                        value: 0n,
                    });
                    gasEstimate = gasEstimate * 150n / 100n; // 1.5x safety margin
                } catch (e) {
                    console.warn('[Forfeit] Gas estimation failed, using default:', e);
                }

                const gasPrice = await pClient.getGasPrice();
                const gasCost = gasEstimate * gasPrice * 2n; // 2x buffer for price fluctuation
                const forwardValue = bal > gasCost ? bal - gasCost : 0n;

                console.log(`[Forfeit] Using session wallet ${sessionAddr}, balance: ${bal}, gasCost: ${gasCost}, forwarding: ${forwardValue}`);

                const hash = await sessionClient.writeContract({
                    address: refs.contractAddressRef.current,
                    abi: MAFIA_ABI,
                    functionName: 'forfeitGame',
                    args: [roomId],
                    account: sessionClient.account!,
                    chain: targetChain,
                    value: forwardValue,
                });

                const receipt = await pClient.waitForTransactionReceipt({ hash });
                if (receipt.status === 'reverted') throw new Error("Forfeit transaction reverted");
            } else {
                // Fallback: no session wallet, use main wallet (no gas drain)
                console.log('[Forfeit] No session wallet, using main wallet');
                const { client: activeWalletClient, account: activeAccount } = await wallet.getActiveWalletClient();

                const gasConfig = await txEngine.getSmartGasConfig({
                    functionName: 'forfeitGame',
                    args: [roomId],
                    account: activeAccount,
                    value: 0n,
                });

                const hash = await activeWalletClient.writeContract({
                    address: refs.contractAddressRef.current,
                    abi: MAFIA_ABI,
                    functionName: 'forfeitGame',
                    args: [roomId],
                    account: activeAccount,
                    chain: targetChain,
                    value: 0n,
                    ...gasConfig,
                });

                const receipt = await pClient.waitForTransactionReceipt({ hash });
                if (receipt.status === 'reverted') throw new Error("Forfeit transaction reverted");
            }

            addLog("Left the game successfully", "success");
            setCurrentRoomId(null);
            return true;
        } catch (e: any) {
            console.error('[Forfeit]', e);
            // If player is already not in the room (NotParticipant / PlayerInactive),
            // treat as success — they're already out, just clean up locally.
            const errMsg = e.shortMessage || e.message || '';
            if (errMsg.includes('NotParticipant') || errMsg.includes('PlayerInactive')) {
                console.log('[Forfeit] Player already removed from room, cleaning up locally');
                setCurrentRoomId(null);
                return true;
            }
            addLog(errMsg, "danger");
            return false;
        } finally {
            setIsTxPending(false);
        }
    }, [refs, wallet, txEngine, setCurrentRoomId, setIsTxPending, addLog]);

    return {
        createLobbyOnChain,
        joinLobbyOnChain,
        forfeitGameOnChain,
    };
}

export type LobbyActions = ReturnType<typeof useLobbyActions>;
