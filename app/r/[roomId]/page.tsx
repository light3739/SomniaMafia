import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchResultData } from '@/services/share/resultData';
import { Role } from '@/types';

interface PageProps {
    params: Promise<{ roomId: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { roomId } = await params;
    const data = await fetchResultData(roomId);

    if (!data || !data.exists) {
        return {
            title: `Room #${roomId} — Mafia OnChain`,
            description: 'Voice mafia with on-chain prizes.',
        };
    }

    const title = data.ended
        ? data.winner === 'MAFIA'
            ? `Mafia won Room #${roomId} — Mafia OnChain`
            : data.winner === 'TOWN'
                ? `The Town won Room #${roomId} — Mafia OnChain`
                : `Room #${roomId} — Mafia OnChain`
        : `Room #${roomId} in progress — Mafia OnChain`;

    const description = data.ended
        ? `${data.players.length} players, ${data.dayCount} days. See the verdict and play your own round.`
        : `A game is unfolding right now in Room #${roomId}. Jump in and play.`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            url: `https://mafiaonchain.live/r/${roomId}`,
            siteName: 'Mafia OnChain',
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
        },
    };
}

const ROLE_LABEL: Record<Role, string> = {
    [Role.MAFIA]: 'Mafia',
    [Role.DOCTOR]: 'Doctor',
    [Role.DETECTIVE]: 'Detective',
    [Role.CIVILIAN]: 'Civilian',
    [Role.UNKNOWN]: 'Unknown',
};

const ROLE_COLOR: Record<Role, string> = {
    [Role.MAFIA]: '#B33A3A',
    [Role.DOCTOR]: '#14B8A6',
    [Role.DETECTIVE]: '#D17A3F',
    [Role.CIVILIAN]: '#C49A6C',
    [Role.UNKNOWN]: '#9CA3AF',
};

export default async function ResultPage({ params }: PageProps) {
    const { roomId } = await params;
    const data = await fetchResultData(roomId);

    if (!data) notFound();
    if (!data.exists) notFound();

    const winnerLabel =
        data.winner === 'MAFIA' ? 'Mafia Wins'
            : data.winner === 'TOWN' ? 'The Town Wins'
                : data.winner === 'DRAW' ? 'Draw'
                    : data.winner === 'ABORTED' ? 'Aborted'
                        : 'Game In Progress';

    const verdictColor =
        data.winner === 'MAFIA' ? '#B33A3A'
            : data.winner === 'TOWN' ? '#C49A6C'
                : '#9CA3AF';

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center px-4 py-12">
            <div className="w-full max-w-2xl flex flex-col items-center text-center gap-6">
                <div className="text-[#C49A3C]/60 text-xs uppercase tracking-[0.3em] font-['Montserrat']">
                    {data.roomName}
                </div>

                <h1
                    className="font-['Cinzel'] uppercase font-bold text-5xl md:text-6xl tracking-[0.1em]"
                    style={{ color: verdictColor }}
                >
                    {winnerLabel}
                </h1>

                {data.ended ? (
                    <p className="text-white/60 text-sm max-w-md">
                        {data.players.length} players, {data.dayCount} day{data.dayCount === 1 ? '' : 's'}.
                    </p>
                ) : (
                    <p className="text-white/60 text-sm max-w-md">
                        This match is still playing. Check back when the verdict is in.
                    </p>
                )}

                {data.ended && data.players.length > 0 && (
                    <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                        {data.players.map(p => (
                            <div
                                key={p.address}
                                className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#19130D]/80 border border-[#C49A6C]/15"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <span
                                        className="text-[10px] uppercase tracking-[0.15em] font-bold font-['Montserrat'] shrink-0"
                                        style={{ color: ROLE_COLOR[p.role] }}
                                    >
                                        {ROLE_LABEL[p.role]}
                                    </span>
                                    <span className="text-white/80 text-sm truncate font-['Montserrat']">
                                        {p.nickname}
                                    </span>
                                </div>
                                <span
                                    className="text-[10px] uppercase tracking-wider shrink-0"
                                    style={{ color: p.isAlive ? '#6B5A4A' : '#8B0000' }}
                                >
                                    {p.isAlive ? 'Alive' : 'Dead'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                <Link
                    href="/"
                    className="mt-6 inline-flex items-center gap-2 px-8 py-4 rounded-md bg-[#1A1510] border border-[#B88A5E] text-[#B88A5E] hover:bg-[#6B5038] hover:border-[#6B5038] hover:text-[#F0E6D8] font-['Montserrat'] font-medium tracking-wide uppercase text-sm transition-all"
                >
                    Play now
                </Link>

                <div className="text-[#C49A3C]/30 text-[10px] uppercase tracking-[0.3em] mt-4 font-['Montserrat']">
                    mafiaonchain.live
                </div>
            </div>
        </div>
    );
}
