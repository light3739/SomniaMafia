import { Role, type Player } from '../types';

export type Winner = 'MAFIA' | 'TOWN' | 'DRAW' | 'ABORTED';

/**
 * Single source of truth for mapping a win-condition string to a Winner value.
 *
 * Accepts strings from two sources:
 *   - Contract GameEnded event (`winCondition` arg from LibGame/GameEndFacet):
 *       "Mafia wins", "Town wins", "Mafia wins (ZK)", "Town wins (ZK)",
 *       "Draw", "Draw: max rounds reached", "Last player standing",
 *       "Aborted pre-game"
 *   - GM server /win-check `result` field: "MAFIA_WIN", "TOWN_WIN"
 *
 * The "Last player standing" case is emitted when aliveCount drops to 1 via
 * forfeit/AFK cascades BEFORE the normal mafia-vs-town parity check fires.
 * The string alone doesn't tell us which team won — we need the survivor's
 * role. Callers that have the player list should pass it so we can resolve
 * authoritatively; callers without it fall back to DRAW rather than guessing.
 *
 * Previous parsers used substring cascades that defaulted to TOWN on any
 * unrecognized string, which silently showed town victory for "Last player
 * standing" and empty/missing strings even when the on-chain prize
 * distribution went to the mafia.
 */
export function parseWinCondition(
    rawWinCondition: string | null | undefined,
    players?: ReadonlyArray<Pick<Player, 'role' | 'isAlive'>>,
): Winner {
    const s = (rawWinCondition ?? '').toString().toLowerCase().trim();
    if (!s) return 'DRAW';

    if (s.includes('abort')) return 'ABORTED';
    if (s.includes('draw')) return 'DRAW';
    if (s.includes('mafia')) return 'MAFIA';
    if (s.includes('town')) return 'TOWN';

    if (s.includes('last player')) {
        // Only resolve MAFIA/TOWN when we have COMPLETE info on every alive
        // player. Partial reveal (some roles still UNKNOWN) can't distinguish
        // "sole survivor is a mafioso whose role hasn't been revealed yet"
        // from "sole survivor is town" — silently filtering UNKNOWN flips a
        // mafia-victory into a false town-victory. If any alive player has
        // an unrevealed role, bail to DRAW; a later reconciler pass (after
        // role reveal completes) will re-parse and correct.
        if (!players) return 'DRAW';
        const allAlive = players.filter(p => p.isAlive);
        if (allAlive.length === 0) return 'DRAW';
        if (allAlive.some(p => p.role === Role.UNKNOWN)) return 'DRAW';
        const anyMafia = allAlive.some(p => p.role === Role.MAFIA);
        return anyMafia ? 'MAFIA' : 'TOWN';
    }

    return 'DRAW';
}
