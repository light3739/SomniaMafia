import { ImageResponse } from 'next/og';
import { fetchResultData } from '@/services/share/resultData';
import { Role } from '@/types';

export const alt = 'Mafia OnChain — game result';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface OGProps {
    params: Promise<{ roomId: string }>;
}

// Palette mirrored from the in-product aesthetic so the share card looks
// consistent with the rest of the app even without Cinzel (next/og's JSX
// subset can use custom fonts via fetch, but we keep v1 on system fonts
// to avoid extra IO at render time).
const BG = '#050505';
const BG_CARD = '#0D0D0D';
const GOLD = '#C49A3C';
const GOLD_SOFT = '#B88A5E';
const RED = '#B33A3A';
const TEAL = '#14B8A6';
const ORANGE = '#D17A3F';
const GREY = '#9CA3AF';

const ROLE_LABEL: Record<Role, string> = {
    [Role.MAFIA]: 'Mafia',
    [Role.DOCTOR]: 'Doctor',
    [Role.DETECTIVE]: 'Detective',
    [Role.CIVILIAN]: 'Civilian',
    [Role.UNKNOWN]: 'Unknown',
};

const ROLE_COLOR: Record<Role, string> = {
    [Role.MAFIA]: RED,
    [Role.DOCTOR]: TEAL,
    [Role.DETECTIVE]: ORANGE,
    [Role.CIVILIAN]: GOLD_SOFT,
    [Role.UNKNOWN]: GREY,
};

export default async function Image({ params }: OGProps) {
    const { roomId } = await params;
    const data = await fetchResultData(roomId);

    const exists = data?.exists ?? false;
    const ended = data?.ended ?? false;
    const winner = data?.winner ?? null;

    const headline = !exists
        ? 'Join the game'
        : !ended
            ? 'Game in progress'
            : winner === 'MAFIA' ? 'Mafia Wins'
                : winner === 'TOWN' ? 'The Town Wins'
                    : winner === 'DRAW' ? 'Draw'
                        : winner === 'ABORTED' ? 'Aborted'
                            : 'Game Over';

    const headlineColor =
        winner === 'MAFIA' ? RED
            : winner === 'TOWN' ? GOLD
                : !exists || !ended ? GOLD
                    : GREY;

    const subtitle = !exists
        ? 'Voice mafia with on-chain prizes'
        : !ended
            ? `Room #${roomId} is still playing`
            : `${data!.players.length} players · ${data!.dayCount} day${data!.dayCount === 1 ? '' : 's'}`;

    // Aggregate role counts for the summary strip at the bottom of the card.
    // Shown only for ended games to avoid leaking role info mid-round.
    const roleCounts: Array<[Role, number]> = [];
    if (ended && data) {
        const counts: Record<Role, number> = {
            [Role.MAFIA]: 0,
            [Role.DOCTOR]: 0,
            [Role.DETECTIVE]: 0,
            [Role.CIVILIAN]: 0,
            [Role.UNKNOWN]: 0,
        };
        for (const p of data.players) counts[p.role]++;
        for (const r of [Role.MAFIA, Role.DOCTOR, Role.DETECTIVE, Role.CIVILIAN] as const) {
            if (counts[r] > 0) roleCounts.push([r, counts[r]]);
        }
    }

    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    background: BG,
                    backgroundImage: `radial-gradient(ellipse at center, ${BG_CARD} 0%, ${BG} 70%)`,
                    padding: '60px 80px',
                    color: '#fff',
                }}
            >
                {/* Top strip — brand + room id */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div
                        style={{
                            fontSize: 22,
                            letterSpacing: '0.3em',
                            textTransform: 'uppercase',
                            color: GOLD,
                            fontWeight: 700,
                        }}
                    >
                        MAFIA · ONCHAIN
                    </div>
                    {exists && (
                        <div
                            style={{
                                fontSize: 18,
                                letterSpacing: '0.25em',
                                textTransform: 'uppercase',
                                color: `${GOLD}99`,
                            }}
                        >
                            Room #{roomId}
                        </div>
                    )}
                </div>

                {/* Center — verdict */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 20,
                    }}
                >
                    <div
                        style={{
                            fontSize: 120,
                            fontWeight: 900,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: headlineColor,
                            textShadow: `0 0 40px ${headlineColor}55`,
                            textAlign: 'center',
                            lineHeight: 1,
                        }}
                    >
                        {headline}
                    </div>
                    <div
                        style={{
                            fontSize: 28,
                            color: '#ffffffaa',
                            letterSpacing: '0.05em',
                            textAlign: 'center',
                        }}
                    >
                        {subtitle}
                    </div>
                </div>

                {/* Bottom strip — role counts (only for ended games) or CTA */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 40,
                        minHeight: 40,
                    }}
                >
                    {roleCounts.length > 0 ? (
                        roleCounts.map(([role, count]) => (
                            <div
                                key={role}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    fontSize: 20,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                    color: ROLE_COLOR[role],
                                    fontWeight: 700,
                                }}
                            >
                                <span>{count}×</span>
                                <span>{ROLE_LABEL[role]}</span>
                            </div>
                        ))
                    ) : (
                        <div
                            style={{
                                fontSize: 22,
                                color: `${GOLD}99`,
                                letterSpacing: '0.25em',
                                textTransform: 'uppercase',
                            }}
                        >
                            mafiaonchain.live
                        </div>
                    )}
                </div>
            </div>
        ),
        {
            ...size,
        },
    );
}
