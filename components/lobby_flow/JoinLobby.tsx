import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrivy } from '@privy-io/react-auth';
import { useGameContext } from '../../contexts/GameContext';
import { useNoirDialog } from '../../contexts/NoirDialogContext';
import { useAccount, useChainId } from 'wagmi';
import { formatEther } from 'viem';
import { MAFIA_ABI } from '../../contracts/config';
import { NetworkSelector } from '../ui/NetworkSelector';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { FlowLayout } from '../layout/FlowLayout';
import { JoinByIdModal } from './JoinByIdModal';

// --- ИКОНКИ ---
const RefreshIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
    </svg>
);
const LockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
);
const TrophyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C49A3C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>
);
const ChevronRight = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
);

interface JoinLobbyProps {
    initialRoomId?: string | null;
    mockCount?: number;
}

// Dev-only mock room generator. Triggered via ?mock=N on the /join URL so
// designers can preview the lobby card at various list lengths without
// touching the chain. Produces a deterministic mix of public / private /
// buy-in / free-roll rooms so every style branch is covered.
function generateMockRooms(count: number): any[] {
    const names = [
        'Mafia Syndicate', 'Sunday Night Poker', 'Golden Hand', 'The Speakeasy',
        'Alpha Table', 'Veterans Only', 'Newbie Zone', 'High Rollers',
        'Midnight Crew', 'The Vault', 'Lucky 13', 'Last Call',
    ];
    const rooms: any[] = [];
    for (let i = 0; i < count; i++) {
        const isTournament = i % 3 === 0;
        const isFreeRoll = isTournament && i % 6 === 0;
        const isPrivate = !isTournament && i % 4 === 0;
        const maxPlayers = 10 + (i % 7);
        const players = Math.max(1, ((i * 3) % maxPlayers) + 1);
        const suffix = i >= names.length ? ` #${Math.floor(i / names.length) + 1}` : '';
        const room: any = {
            id: 1000 + i,
            host: `0x${i.toString(16).padStart(40, '0')}`,
            name: names[i % names.length] + suffix,
            players: Math.min(players, maxPlayers - 1),
            max: maxPlayers,
            phase: 0,
            timestamp: Math.floor(Date.now() / 1000) - i * 30,
            isPrivate,
            tournamentId: isTournament ? BigInt(i + 1) : 0n,
            depositPool: 0n,
        };
        if (isTournament) {
            room.buyIn = isFreeRoll ? 0n : BigInt(i + 1) * 100000000000000000n; // 0.1·(i+1) ETH
            room.prizePool = isFreeRoll ? 5000000000000000000n : 0n; // 5 ETH for free-roll
        }
        rooms.push(room);
    }
    return rooms;
}

// Parse a room struct (handles both tuple-array and object forms from viem)
function parseRoom(id: bigint, data: any): {
    id: number; host: string; name: string; players: number; max: number;
    phase: number; timestamp: number; isPrivate: boolean; tournamentId: bigint;
    depositPool: bigint;
} | null {
    try {
        let phase: number, timestamp: number, host: string, name: string, playersCount: number, maxPlayers: number, isPrivate: boolean, tournamentId: bigint, depositPool: bigint;
        if (Array.isArray(data)) {
            phase = Number(data[3]); timestamp = Number(data[9]); host = data[1];
            name = data[2]; playersCount = Number(data[5]); maxPlayers = Number(data[4]);
            isPrivate = Boolean(data[18]);
            tournamentId = BigInt(data[19] || 0);
            depositPool = BigInt(data[16] || 0);
        } else {
            phase = Number(data.phase); timestamp = Number(data.lastActionTimestamp);
            host = data.host; name = data.name;
            playersCount = Number(data.playersCount); maxPlayers = Number(data.maxPlayers);
            isPrivate = Boolean(data.isPrivate);
            tournamentId = BigInt(data.tournamentId || 0);
            depositPool = BigInt(data.depositPool || 0);
        }
        return {
            id: Number(data.id ?? id), host, name, players: playersCount,
            max: maxPlayers, phase, timestamp, isPrivate, tournamentId, depositPool
        };
    } catch (e) {
        console.error("[JoinLobby] parseRoom error:", e);
        return null;
    }
}

function getTournamentInfo(room: any): { isTournament: boolean; hasPassword?: boolean } {
    const isTournament = room.tournamentId ? room.tournamentId > 0n : false;
    return { isTournament, hasPassword: room.isPrivate };
}

function formatPrizePool(amount: bigint): string {
    const val = parseFloat(formatEther(amount));
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    if (val >= 1) return val.toFixed(2);
    if (val > 0) return val.toFixed(4);
    return '0';
}

export const JoinLobby: React.FC<JoinLobbyProps> = ({ initialRoomId, mockCount = 0 }) => {
    const { setLobbyName, joinLobbyOnChain, isTxPending, runtimeContractAddress, publicClient: ctxPublicClient, currencySymbol, isWalletReady, setLobbyPassword } = useGameContext();
    const { showPrompt, showAlert } = useNoirDialog();
    const { login, authenticated } = usePrivy();
    const { isConnected } = useAccount();

    const chainId = useChainId();
    const prevChainIdRef = useRef(chainId);

    const router = useRouter();
    const publicClient = ctxPublicClient;

    const [rooms, setRooms] = useState<any[]>([]);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Lobby browser filter / pagination state. Filter and search are
    // applied client-side over the polled `rooms` list — no extra RPC.
    type FilterType = 'all' | 'public' | 'private' | 'tournament';
    const [filterType, setFilterType] = React.useState<FilterType>('all');
    const [searchQuery, setSearchQuery] = React.useState('');
    const [currentPage, setCurrentPage] = React.useState(1);
    const PAGE_SIZE = 5;

    // Re-fetch a single room directly from chain and validate it. Returns the
    // parsed room on success, or null after surfacing a popup error to the
    // user. Used by both the join-by-code prompt and the URL invite flow so
    // the validation rules / error wording stay in one place.
    const fetchAndValidateRoom = React.useCallback(
        async (numericId: string): Promise<ReturnType<typeof parseRoom> | null> => {
            if (!publicClient) {
                await showAlert("Wallet client isn't ready yet. Please wait a moment and try again.", { variant: 'danger', title: 'Not Ready' });
                return null;
            }
            let idBig: bigint;
            try { idBig = BigInt(numericId); } catch {
                await showAlert("That room code isn't valid.", { title: 'Invalid Code' });
                return null;
            }

            try {
                const data = await publicClient.readContract({
                    address: runtimeContractAddress, abi: MAFIA_ABI,
                    functionName: 'getRoom', args: [idBig],
                });
                const parsed = parseRoom(idBig, data);
                if (!parsed || parsed.host === '0x0000000000000000000000000000000000000000' || parsed.max === 0) {
                    await showAlert(`Room #${numericId} doesn't exist.`, { title: 'Room Not Found' });
                    return null;
                }
                if (parsed.phase !== 0) {
                    await showAlert(`Room #${numericId} has already started or ended.`, { title: 'Game In Progress' });
                    return null;
                }
                if (parsed.players >= parsed.max) {
                    await showAlert(`Room #${numericId} is full.`, { title: 'Room Full' });
                    return null;
                }
                return parsed;
            } catch (e) {
                console.error('[JoinLobby] fetchAndValidateRoom error:', e);
                await showAlert(`Couldn't load room #${numericId}. Please try again.`, { title: 'Network Error' });
                return null;
            }
        },
        [publicClient, runtimeContractAddress, showAlert]
    );

    // Loading flag for numeric on-chain lookup (triggered from the search
    // fallback CTA when the user types a room id that isn't in the polled
    // list). Separate from isRefreshing/isTxPending so lookup spinners
    // don't collide with list polling or tx state.
    const [isLookingUp, setIsLookingUp] = useState(false);

    // Holds a room fetched via direct RPC lookup so it can be rendered as
    // a regular card in the list (two-step flow: look up → see card →
    // click card → join). Survives polling cycles that would otherwise
    // replace `rooms` without this id. Cleared when the search query
    // changes so the CTA re-appears for the new query.
    const [lookedUpRoom, setLookedUpRoom] = useState<any | null>(null);

    // Join-by-ID modal (panel-level action — fetches the room on-chain
    // directly and drops it into the list as a card the user can confirm
    // and click, skipping the search-bar "Look up Room #X" intermediate).
    const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
    const [isCodeLookingUp, setIsCodeLookingUp] = useState(false);

    useEffect(() => {
        // Clear the looked-up room when search changes, EXCEPT when the new
        // query still matches its id — otherwise programmatically setting
        // searchQuery alongside lookedUpRoom (e.g. from the Join-by-ID modal)
        // would immediately wipe the room we just set.
        setLookedUpRoom((prev: any | null) => {
            if (!prev) return prev;
            if (String(prev.id) === searchQuery.trim()) return prev;
            return null;
        });
    }, [searchQuery]);

    // Smart fallback triggered when the search query is a pure number and
    // the local filter returned nothing. Does a direct getRoom RPC and
    // stores the validated room — it's then merged into the display pool
    // and shown as a normal card the user can click to join.
    const handleNumericLookup = async () => {
        const numeric = searchQuery.trim();
        if (!/^\d+$/.test(numeric)) return;
        if (!publicClient) {
            await showAlert("Wallet client isn't ready yet. Please wait a moment and try again.", { variant: 'danger', title: 'Not Ready' });
            return;
        }

        setIsLookingUp(true);
        try {
            const room = await fetchAndValidateRoom(numeric);
            if (!room) return;
            setLookedUpRoom(room);
        } finally {
            setIsLookingUp(false);
        }
    };

    // Display pool = polled rooms + any manually looked-up room (if not
    // already in the polled list). Looked-up rooms survive polling
    // cycles so a direct-lookup result doesn't flicker out when the
    // next scan replaces `rooms`.
    const displayRooms = React.useMemo(() => {
        if (!lookedUpRoom) return rooms;
        if (rooms.some((r) => r.id === lookedUpRoom.id)) return rooms;
        return [lookedUpRoom, ...rooms];
    }, [rooms, lookedUpRoom]);

    const filteredRooms = React.useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return displayRooms.filter((r) => {
            // Type filter
            const isTournament = r.tournamentId ? r.tournamentId > 0n : false;
            if (filterType === 'public' && r.isPrivate) return false;
            if (filterType === 'private' && !r.isPrivate) return false;
            if (filterType === 'tournament' && !isTournament) return false;
            // Search by name or numeric id
            if (q) {
                const nameMatch = (r.name || '').toLowerCase().includes(q);
                const idMatch = String(r.id).includes(q);
                if (!nameMatch && !idMatch) return false;
            }
            return true;
        });
    }, [displayRooms, filterType, searchQuery]);

    const pageCount = Math.max(1, Math.ceil(filteredRooms.length / PAGE_SIZE));
    // Clamp current page if filter / refresh shrinks the list under it.
    React.useEffect(() => {
        if (currentPage > pageCount) setCurrentPage(pageCount);
    }, [pageCount, currentPage]);
    // Reset to page 1 whenever filter or search changes so the user always
    // sees the top of the new result set.
    React.useEffect(() => { setCurrentPage(1); }, [filterType, searchQuery]);

    const pagedRooms = React.useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredRooms.slice(start, start + PAGE_SIZE);
    }, [filteredRooms, currentPage]);

    // Pure-numeric query fallback: if the user types a room id that isn't
    // in the locally polled list (only the last ~18 recent rooms are
    // loaded), we surface a "Look up Room #N" CTA that does a direct
    // getRoom RPC call. Keeps the search input as the single entry point.
    const trimmedQuery = searchQuery.trim();
    const isNumericQuery = /^\d+$/.test(trimmedQuery);
    const showNumericLookup = !isInitialLoad && isNumericQuery && filteredRooms.length === 0;

    const mountedRef = useRef(true);
    const lastFetchRef = useRef(0);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const MAX_LOBBY_AGE_SEC = 4 * 60 * 60;

    type FetchReason = 'initial' | 'refresh' | 'polling';

    const fetchRooms = useCallback(async (reason: FetchReason = 'polling') => {
        if (mockCount > 0) return; // mock mode bypasses chain reads entirely
        if (!publicClient) return;

        const now = Date.now();
        if (reason === 'polling' && now - lastFetchRef.current < 1500) return;
        lastFetchRef.current = now;

        const isHardLoad = reason === 'initial' || reason === 'refresh';

        // Only the very first load shows the "Scanning Network..." radar.
        // Refresh keeps the existing filter/search/code-input UI on screen
        // and just spins the refresh icon via isRefreshing — without this,
        // clicking refresh used to wipe the whole panel back to the radar.
        if (reason === 'initial') setIsInitialLoad(true);
        if (reason === 'refresh') setIsRefreshing(true);

        const fetchStartTime = Date.now();

        try {
            const roomList: any[] = [];
            const nextId = await publicClient.readContract({
                address: runtimeContractAddress, abi: MAFIA_ABI,
                functionName: 'nextRoomId',
            }) as bigint;

            const lookAhead = 3n;
            const scanEnd = nextId + lookAhead;
            const scanCount = 15n + lookAhead;
            const start = scanEnd > scanCount ? scanEnd - scanCount : 0n;

            const queries = Array.from({ length: Number(scanEnd - start) }, (_, idx) => scanEnd - 1n - BigInt(idx));
            if (initialRoomId) {
                try {
                    const idAsBigInt = BigInt(initialRoomId);
                    if (!queries.includes(idAsBigInt)) {
                        queries.push(idAsBigInt);
                    }
                } catch (e) {
                    console.warn('Invalid invite link ID format:', initialRoomId);
                }
            }

            const results = await Promise.allSettled(
                queries.map(i => publicClient.readContract({
                    address: runtimeContractAddress, abi: MAFIA_ABI,
                    functionName: 'getRoom', args: [i],
                }).then((data: any) => ({ i, data })))
            );

            const nowSec = Math.floor(Date.now() / 1000);
            for (const res of results) {
                if (res.status !== 'fulfilled') continue;
                const parsed = parseRoom(res.value.i, res.value.data);
                if (!parsed) continue;

                const isLobby = parsed.phase === 0;
                const isRecent = parsed.timestamp === 0 || (nowSec - parsed.timestamp) < MAX_LOBBY_AGE_SEC;
                const isValid = parsed.host !== '0x0000000000000000000000000000000000000000' && parsed.max > 0;

                if (isLobby && isRecent && isValid && parsed.players > 0) {
                    roomList.push(parsed);
                }
            }

            // Fetch tournament prize pools for tournament rooms
            const tournamentRooms = roomList.filter(r => r.tournamentId > 0n);
            if (tournamentRooms.length > 0 && publicClient) {
                const uniqueTournamentIds = [...new Set(tournamentRooms.map(r => r.tournamentId))];
                const tResults = await Promise.allSettled(
                    uniqueTournamentIds.map(tId =>
                        publicClient.readContract({
                            address: runtimeContractAddress, abi: MAFIA_ABI,
                            functionName: 'getTournament', args: [tId],
                        }).then((data: any) => ({ tId, data }))
                    )
                );

                const tMap = new Map<string, { prizePool: bigint; buyIn: bigint }>();
                for (const res of tResults) {
                    if (res.status !== 'fulfilled') continue;
                    const { tId, data } = res.value;
                    const prizePool = Array.isArray(data) ? BigInt(data[4] || 0) : BigInt(data.prizePool || 0);
                    const buyIn = Array.isArray(data) ? BigInt(data[3] || 0) : BigInt(data.buyIn || 0);
                    tMap.set(tId.toString(), { prizePool, buyIn });
                }

                for (const room of roomList) {
                    if (room.tournamentId > 0n) {
                        const tInfo = tMap.get(room.tournamentId.toString());
                        if (tInfo) {
                            (room as any).prizePool = tInfo.prizePool + room.depositPool;
                            (room as any).buyIn = tInfo.buyIn;
                        }
                    }
                }
            }

            roomList.sort((a, b) => b.id - a.id);

            if (isHardLoad && mountedRef.current) {
                const elapsed = Date.now() - fetchStartTime;
                const MIN_RADAR_TIME = 800;
                if (elapsed < MIN_RADAR_TIME) {
                    await new Promise(resolve => setTimeout(resolve, MIN_RADAR_TIME - elapsed));
                }
            }

            if (mountedRef.current) {
                setRooms(roomList);
                setIsInitialLoad(false);

                if (reason === 'refresh') {
                    const elapsed = Date.now() - fetchStartTime;
                    const MIN_REFRESH_TIME = 500;
                    const remaining = Math.max(0, MIN_REFRESH_TIME - elapsed);
                    setTimeout(() => {
                        if (mountedRef.current) setIsRefreshing(false);
                    }, remaining);
                }
            }
        } catch (e) {
            console.error('[JoinLobby] fetchRooms error:', e);
            if (mountedRef.current) {
                setIsInitialLoad(false);
                setIsRefreshing(false);
            }
        }
    }, [publicClient, initialRoomId, runtimeContractAddress, mockCount]);

    // Mock mode: inject fake rooms from ?mock=N and skip polling entirely.
    // Lets designers preview the lobby card at different list lengths
    // without spinning up a chain or waiting on RPCs.
    useEffect(() => {
        if (mockCount <= 0) return;
        setRooms(generateMockRooms(mockCount));
        setIsInitialLoad(false);
    }, [mockCount]);

    useEffect(() => {
        if (chainId !== prevChainIdRef.current) {
            prevChainIdRef.current = chainId;
            setRooms([]);
            fetchRooms('initial');
        }
    }, [chainId, fetchRooms]);

    useEffect(() => {
        mountedRef.current = true;

        if (rooms.length === 0 && isInitialLoad) {
            fetchRooms('initial');
        }

        const interval = setInterval(() => {
            if (!document.hidden) {
                fetchRooms('polling');
            }
        }, 3000);

        let unwatch1: (() => void) | undefined;
        let unwatch2: (() => void) | undefined;

        if (publicClient) {
            try {
                unwatch1 = publicClient.watchContractEvent({
                    address: runtimeContractAddress, abi: MAFIA_ABI,
                    eventName: 'RoomCreated',
                    onLogs: () => { fetchRooms('polling'); },
                });
                unwatch2 = publicClient.watchContractEvent({
                    address: runtimeContractAddress, abi: MAFIA_ABI,
                    eventName: 'PlayerJoined',
                    onLogs: () => { fetchRooms('polling'); },
                });
            } catch (e) {
                console.warn("Event watch failed", e);
            }
        }

        return () => {
            mountedRef.current = false;
            clearInterval(interval);
            unwatch1?.();
            unwatch2?.();
        };
    }, [fetchRooms, publicClient, runtimeContractAddress]);

    const handleJoin = async (room: any) => {
        if (!isConnected || !authenticated) {
            login();
            return;
        }

        // Wait until wagmi/Privy finished hydrating before touching the wallet.
        // Without this, getActiveWalletClient may resolve against a stale Privy
        // embedded address while the actual signer is the still-locked external
        // wallet — leading to a session keyed by the wrong address and a second
        // pubkey popup later in WaitingRoom.
        if (!isWalletReady) return;

        let pass = '';
        if (room.isPrivate) {
            const inputPass = await showPrompt("Enter room password:", { title: 'Private Room', placeholder: 'Password...' });
            if (!inputPass) return;
            pass = inputPass;
            setLobbyPassword(pass);
        } else {
            setLobbyPassword('');
        }

        const success = await joinLobbyOnChain(BigInt(room.id), pass);
        if (success) {
            setLobbyName(room.name || `Room #${room.id}`);
            router.push('/waiting');
        }
    };

    // Auto-join when arriving from a deep-link URL like /join?roomId=142.
    // We bypass the (removed) invite banner entirely: as soon as the wallet
    // is ready we read the room directly, validate it, and run the same join
    // flow as the in-page # button. Errors surface as alert popups so the
    // user lands on the normal lobby browser, not a dead-end screen.
    //
    // If the user isn't logged in we trigger Privy's login() once so they
    // aren't stranded silently — after auth completes the effect re-runs via
    // its `authenticated` dep and continues to the join step.
    const inviteAutoJoinedRef = useRef(false);
    const inviteLoginRequestedRef = useRef(false);
    useEffect(() => {
        if (!initialRoomId) return;
        if (inviteAutoJoinedRef.current) return;
        if (!publicClient) return;

        if (!isConnected || !authenticated) {
            if (!inviteLoginRequestedRef.current) {
                inviteLoginRequestedRef.current = true;
                login();
            }
            return;
        }
        if (!isWalletReady) return;

        inviteAutoJoinedRef.current = true;
        (async () => {
            const numeric = String(initialRoomId).replace(/[^0-9]/g, '');
            if (!numeric) {
                await showAlert("That invite link isn't valid.", { title: 'Invalid Invite' });
                return;
            }
            const room = await fetchAndValidateRoom(numeric);
            if (!room) return;
            await handleJoin(room);
        })();
        // handleJoin is referenced at call time, after init — safe to omit.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialRoomId, publicClient, isConnected, authenticated, isWalletReady, fetchAndValidateRoom, showAlert, login]);

    return (
        <FlowLayout
            backTo="/setup"
            rightElement={<NetworkSelector compact />}
        >
            <div className="w-full max-w-[600px] flex flex-col items-center gap-4 md:gap-6">

                {/* Main Card */}
                <div className="w-full bg-[rgba(40,22,8,0.70)] backdrop-blur-md rounded-2xl p-6 md:p-8 border border-white/10 shadow-2xl flex flex-col gap-6 mt-2">

                {/* Заголовок списка */}
                <div className="flex items-center justify-between w-full border-b border-white/10 pb-4">
                    <h2 className="text-white text-xl md:text-2xl font-['Cinzel'] tracking-widest">
                        Live Sessions
                    </h2>
                    <div className="flex items-center gap-2.5 md:gap-3">
                        <button
                            onClick={() => setIsCodeModalOpen(true)}
                            disabled={!isWalletReady}
                            title="Join a room directly by its ID"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1A1510] border border-[#B88A5E] text-[#B88A5E] hover:bg-[#6B5038] hover:border-[#6B5038] hover:text-[#F0E6D8] active:scale-[0.98] transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <span className="text-base leading-none font-['Cinzel'] translate-y-[-0.5px]">#</span>
                            <span className="text-[10px] font-bold uppercase tracking-[0.22em] font-['Montserrat']">
                                <span className="hidden sm:inline">Join by ID</span>
                                <span className="sm:hidden">By ID</span>
                            </span>
                        </button>
                        <div className="w-px h-5 bg-white/10" aria-hidden />
                        <button
                            onClick={() => fetchRooms('refresh')}
                            disabled={isRefreshing || isInitialLoad}
                            className="text-[#C49A3C] hover:text-[#A8784F] transition-colors p-1 disabled:opacity-50"
                            title="Refresh List"
                        >
                            <motion.div animate={{ rotate: isRefreshing ? 360 : 0 }} transition={{ duration: 0.5, ease: "easeInOut" }}>
                                <RefreshIcon className="w-5 h-5 md:w-6 md:h-6" />
                            </motion.div>
                        </button>
                    </div>
                </div>

                {/* Filter chips + search — always visible so the panel doesn't
                    flicker in/out around the radar scan. Inputs are disabled
                    while the initial scan is running, since there's nothing to
                    filter against yet. */}
                <div className="w-full flex flex-col gap-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                        {([
                            { id: 'all', label: 'All' },
                            { id: 'public', label: 'Public' },
                            { id: 'private', label: 'Private' },
                            { id: 'tournament', label: 'Tournament' },
                        ] as { id: FilterType; label: string }[]).map((chip) => {
                            const active = filterType === chip.id;
                            return (
                                <button
                                    key={chip.id}
                                    onClick={() => setFilterType(chip.id)}
                                    disabled={isInitialLoad}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-[0.15em] font-['Montserrat'] transition-all disabled:opacity-50 disabled:cursor-not-allowed ${active
                                        ? 'bg-[#C49A3C] text-[#281608] border border-[#C49A3C]'
                                        : 'bg-black/30 text-white/55 border border-white/10 hover:border-white/20 hover:text-white/80'
                                        }`}
                                >
                                    {chip.label}
                                </button>
                            );
                        })}
                        {!isInitialLoad && (
                            <span className="text-white/35 text-[10px] font-mono ml-auto">
                                {filteredRooms.length} {filteredRooms.length === 1 ? 'lobby' : 'lobbies'}
                            </span>
                        )}
                    </div>
                    <Input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name or room id…"
                        disabled={isInitialLoad}
                        containerClassName="w-full"
                        className="h-[50px] md:h-[54px] !text-sm !text-left !px-4 !font-['Montserrat'] focus:!border-[#C49A3C]"
                    />
                </div>

                {/* Список комнат — фиксированная высота под PAGE_SIZE карточек,
                    чтобы рамка не прыгала при появлении/исчезновении комнат.
                    Панель (bg + border + rounded) живёт на ВНЕШНЕМ контейнере,
                    чтобы не пересоздавалась при смене состояния — иначе вся
                    рамка моргала на каждом search-toggle. AnimatePresence
                    кросс-фейдит только контент внутри. */}
                <div className="relative w-full h-[460px] md:h-[490px] bg-black/30 rounded-xl border border-white/10 overflow-hidden">
                    <AnimatePresence mode="wait">
                        {isInitialLoad ? (
                            <motion.div
                                key="scanning"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.18 }}
                                className="absolute inset-0 flex flex-col items-center justify-center py-10"
                            >
                                <div className="relative flex items-center justify-center mb-6 mt-2">
                                    <div className="absolute w-16 h-16 border-2 border-[#C49A3C] rounded-full animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite] opacity-20" />
                                    <div className="absolute w-10 h-10 border-2 border-[#C49A3C] rounded-full animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite] opacity-40" style={{ animationDelay: '0.4s' }} />
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C49A3C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                                        <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                                    </svg>
                                </div>
                                <span className="text-white/60 font-medium tracking-wide text-sm animate-pulse">
                                    Scanning Network...
                                </span>
                            </motion.div>
                        ) : showNumericLookup ? (
                            <motion.div
                                key="numeric-lookup"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.18 }}
                                className="absolute inset-0 flex flex-col items-center justify-center py-10 px-6"
                            >
                                <span className="text-[#C49A3C]/30 mb-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                </span>
                                <span className="text-white/85 text-center font-['Cinzel'] text-lg md:text-xl tracking-wide leading-snug mb-1">
                                    Room #{trimmedQuery} isn't in the live list.
                                </span>
                                <span className="text-white/45 text-center text-xs md:text-sm leading-relaxed mb-5 max-w-[340px]">
                                    It might be an older lobby or one without players yet. Look it up directly on-chain.
                                </span>
                                <Button
                                    onClick={handleNumericLookup}
                                    variant="primary-lobby"
                                    isLoading={isLookingUp}
                                    disabled={isLookingUp || !isWalletReady}
                                    className="mt-1 h-[48px] md:h-[52px] px-10 text-base md:text-lg tracking-[0.1em]"
                                >
                                    {isLookingUp ? 'Looking up…' : `Look up Room #${trimmedQuery}`}
                                </Button>
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="mt-3 text-[10px] text-[#C49A3C]/80 hover:text-[#C49A3C] uppercase tracking-[0.2em] font-bold font-['Montserrat']"
                                >
                                    Clear search
                                </button>
                            </motion.div>
                        ) : displayRooms.length === 0 ? (
                            <motion.div
                                key="empty"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.18 }}
                                className="absolute inset-0 flex flex-col items-center justify-center py-10 px-6"
                            >
                                <span className="text-[#C49A3C]/30 mb-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                </span>
                                <span className="text-white/85 text-center font-['Cinzel'] text-lg md:text-xl tracking-wide leading-snug mb-1">
                                    No tables open right now.
                                </span>
                                <span className="text-white/45 text-center text-xs md:text-sm leading-relaxed mb-5 max-w-[340px]">
                                    Be the first to deal a hand. Create a room, invite your crew, win the pot.
                                </span>
                                <Button
                                    onClick={() => router.push('/create')}
                                    variant="primary-lobby"
                                    className="mt-1 h-[48px] md:h-[52px] px-10 text-base md:text-lg tracking-[0.1em]"
                                >
                                    Create Game
                                </Button>
                            </motion.div>
                        ) : filteredRooms.length === 0 ? (
                            <motion.div
                                key="filter-empty"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.18 }}
                                className="absolute inset-0 flex flex-col items-center justify-center py-10"
                            >
                                <span className="text-[#C49A3C]/30 mb-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                </span>
                                <span className="text-white/60 text-center leading-relaxed">
                                    No lobbies match your filter.
                                </span>
                                <button
                                    onClick={() => { setFilterType('all'); setSearchQuery(''); }}
                                    className="mt-3 text-[10px] text-[#C49A3C]/80 hover:text-[#C49A3C] uppercase tracking-[0.2em] font-bold font-['Montserrat']"
                                >
                                    Clear filters
                                </button>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="list"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.18 }}
                                className="absolute inset-0 flex flex-col gap-3 p-3 overflow-y-auto"
                            >
                                {pagedRooms.map((room) => {
                                        const tournament = getTournamentInfo(room);
                                        return (
                                            <motion.button
                                                key={room.id}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => handleJoin(room)}
                                                disabled={isTxPending || !isWalletReady}
                                                className={`w-full p-4 md:p-5 backdrop-blur-md rounded-md flex items-center justify-between group transition-colors relative overflow-hidden text-left
                                                    ${tournament.isTournament
                                                        ? 'bg-gradient-to-r from-[#2A1F0A] to-[#19130D] border border-[#C49A3C]/30 hover:border-[#C49A3C]/60 shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
                                                        : 'bg-[#19130D]/80 border border-white/5 hover:border-white/20 shadow-lg'
                                                    }
                                                `}
                                            >
                                                {tournament.isTournament && (
                                                    <div className="absolute inset-0 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity">
                                                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C49A3C]/50 to-transparent" />
                                                    </div>
                                                )}

                                                <div className="flex flex-col items-start gap-1.5">
                                                    <div className="flex items-center gap-2">
                                                        {tournament.isTournament && <TrophyIcon />}
                                                        <span className={`text-base md:text-lg font-bold tracking-wide ${tournament.isTournament ? 'text-[#A8784F]' : 'text-white/90'}`}>
                                                            {room.name || `Room #${room.id}`}
                                                        </span>
                                                        {tournament.hasPassword && <LockIcon />}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white/60 text-[10px] font-mono uppercase">HOST: {room.host.slice(0, 8)}...</span>
                                                        {tournament.isTournament && (
                                                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#C49A3C]/10 text-[#C49A3C] border border-[#C49A3C]/20">
                                                                Tournament
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-5">
                                                    {tournament.isTournament && (
                                                        <div className="text-right hidden sm:block">
                                                            {(room as any).buyIn > 0n ? (
                                                                <>
                                                                    <span className="text-[#C49A3C] font-bold text-sm block">{formatPrizePool((room as any).buyIn)} {currencySymbol}</span>
                                                                    <span className="text-[#C49A3C]/50 text-[9px] uppercase tracking-widest">Buy-in</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span className="text-[#4caf82] font-bold text-sm block">Free</span>
                                                                    <span className="text-[#4caf82]/50 text-[9px] uppercase tracking-widest">Free Roll</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="text-right">
                                                        <span className={`font-bold text-lg block leading-none ${tournament.isTournament ? 'text-[#C49A3C]' : 'text-white/80'}`}>
                                                            {room.players}<span className="text-white/50 text-sm">/{room.max}</span>
                                                        </span>
                                                        <span className="text-white/50 text-[9px] uppercase tracking-widest mt-1 block">Players</span>
                                                    </div>

                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300
                                                        ${tournament.isTournament
                                                            ? 'bg-[#C49A3C]/10 text-[#C49A3C] group-hover:bg-[#C49A3C] group-hover:text-[#281608]'
                                                            : 'bg-white/5 text-white/50 group-hover:bg-white/20 group-hover:text-white'
                                                        }
                                                    `}>
                                                        <ChevronRight />
                                                    </div>
                                                </div>
                                            </motion.button>
                                        );
                                    })}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Pagination — место всегда зарезервировано (min-h), кнопки
                    рендерятся только когда filteredRooms > PAGE_SIZE. Это
                    убирает ~32px прыжок карточки при листании между разным
                    количеством страниц. */}
                <div className="w-full min-h-[32px] flex items-center justify-center gap-3 mt-1">
                    {!isInitialLoad && filteredRooms.length > PAGE_SIZE && (
                        <>
                            <button
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage <= 1}
                                className="px-3 py-1.5 rounded-lg bg-black/30 border border-white/10 text-white/70 text-[10px] uppercase font-bold tracking-[0.15em] font-['Montserrat'] hover:border-[#C49A3C]/40 hover:text-[#C49A3C] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                ‹ Prev
                            </button>
                            <span className="text-white/55 text-[11px] font-mono tabular-nums">
                                {currentPage} / {pageCount}
                            </span>
                            <button
                                onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
                                disabled={currentPage >= pageCount}
                                className="px-3 py-1.5 rounded-lg bg-black/30 border border-white/10 text-white/70 text-[10px] uppercase font-bold tracking-[0.15em] font-['Montserrat'] hover:border-[#C49A3C]/40 hover:text-[#C49A3C] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                Next ›
                            </button>
                        </>
                    )}
                </div>

                </div>
                {/* /Main Card */}

                {(!isConnected || !authenticated) && rooms.length > 0 && !initialRoomId && (
                    <div className="mt-2 text-white/60 text-xs italic">
                        * Wallet connection required to enter a session
                    </div>
                )}
            </div>
            <JoinByIdModal
                open={isCodeModalOpen}
                isLoading={isCodeLookingUp}
                onClose={() => setIsCodeModalOpen(false)}
                onSubmit={async (id) => {
                    // Fetch the room on-chain right inside the modal, then
                    // surface it as a card in the list (via lookedUpRoom +
                    // searchQuery filter). User then clicks the card to
                    // actually join — they get one visual confirmation step
                    // instead of being thrown straight into a tx popup.
                    setIsCodeLookingUp(true);
                    try {
                        const room = await fetchAndValidateRoom(id);
                        if (!room) return; // fetchAndValidateRoom showed the alert; keep modal open
                        setLookedUpRoom(room);
                        setSearchQuery(id);
                        setIsCodeModalOpen(false);
                    } finally {
                        setIsCodeLookingUp(false);
                    }
                }}
            />
        </FlowLayout>
    );
};
