/**
 * Script to calculate the total cost of a Mafia game for N players
 * 
 * This simulates all on-chain actions throughout a complete game
 */

interface ActionCost {
    name: string;
    occurrences: number;
    estimatedGas: bigint;
    totalGas: bigint;
}

interface GameCostReport {
    players: number;
    mafiaCount: number;
    townCount: number;
    rounds: number;
    actions: ActionCost[];
    totalGasUsed: bigint;
    totalCostSTT: string;
    perPlayerCostSTT: string;
}

// REALISTIC Gas estimates based on actual Somnia testnet transactions and fallbacks in code
// Source: GameContext.tsx lines 219-234 show actual fallback values used
const GAS_ESTIMATES = {
    // Pre-game phase (mainWallet - these are paid from user wallet, not session key)
    createAndJoin: 5_000_000n,       // Big tx: Create room + join + register session + store string + bytes
    joinRoom: 5_000_000n,            // Join room + register session + store publicKey bytes
    startGame: 2_000_000n,           // Start the game, iterate all players

    // Shuffle phase (PER PLAYER - sequential, session key pays)
    commitDeck: 1_000_000n,          // Commit deck hash (storage write)
    revealDeck: 30_000_000n,         // **HEAVY**: Reveal deck (stores string[] array on-chain!)

    // Reveal phase (PER PLAYER, session key pays)  
    shareKeysToAll: 30_000_000n,     // **HEAVY**: Store encrypted keys to N-1 players (bytes[] + loops)
    commitAndConfirmRole: 1_000_000n,// Commit role hash + confirm role

    // Day/Voting phase (PER PLAYER PER ROUND, session key pays)
    startVoting: 2_000_000n,         // Reset voting state, loops all players
    vote: 500_000n,                  // Cast/change vote

    // Night phase (PER SPECIAL ROLE PER ROUND, session key pays)
    commitNightAction: 500_000n,     // Doctor/Detective commit
    revealNightAction: 1_000_000n,   // Doctor/Detective reveal (hash verify + storage)
    commitMafiaTarget: 500_000n,     // Mafia commit target
    revealMafiaTarget: 2_000_000n,   // Mafia reveal target + consensus check
    endNight: 5_000_000n,            // Finalize night (loops, kill logic, reset)

    // Endgame (session key pays, except endGameZK which may use main wallet)
    revealRole: 2_000_000n,          // Reveal role for ZK proof (hash verify + storage)
    endGameZK: 100_000_000n,         // **EXTREMELY HEAVY**: Groth16 verifier + state changes (fallback in code is 100M!)
};

// Gas price on Somnia testnet - from eth_gasPrice RPC call: 0x165a0bc00 = 6 gwei
const GAS_PRICE = 6_000_000_000n; // 6 gwei (ACTUAL current testnet price!)

function calculateMafiaCount(players: number): number {
    // Standard Mafia rules: roughly 1/3 mafia
    if (players <= 6) return 1;
    if (players <= 10) return 2;
    if (players <= 15) return 3;
    return 4;
}

function calculateRounds(players: number, mafiaCount: number): number {
    // Rough estimate: game lasts until mafia wins or is eliminated
    // Average rounds = (players - mafiaCount) / 2 + mafiaCount
    // This assumes roughly 1 elimination per round (day + night)
    const townCount = players - mafiaCount;
    // Approximate: each round kills ~1 person, game ends when mafia = town or mafia = 0
    return Math.ceil(townCount / 2) + 1;
}

function calculateGameCost(players: number): GameCostReport {
    const mafiaCount = calculateMafiaCount(players);
    const townCount = players - mafiaCount;
    const rounds = calculateRounds(players, mafiaCount);

    const actions: ActionCost[] = [];

    // ========== PRE-GAME PHASE ==========

    // 1. Host creates and joins room
    actions.push({
        name: "createAndJoin (host)",
        occurrences: 1,
        estimatedGas: GAS_ESTIMATES.createAndJoin,
        totalGas: GAS_ESTIMATES.createAndJoin
    });

    // 2. Other players join
    actions.push({
        name: "joinRoom (other players)",
        occurrences: players - 1,
        estimatedGas: GAS_ESTIMATES.joinRoom,
        totalGas: GAS_ESTIMATES.joinRoom * BigInt(players - 1)
    });

    // 3. Start game
    actions.push({
        name: "startGame",
        occurrences: 1,
        estimatedGas: GAS_ESTIMATES.startGame,
        totalGas: GAS_ESTIMATES.startGame
    });

    // ========== SHUFFLE PHASE ==========

    // Each player commits and reveals deck (sequential)
    actions.push({
        name: "commitDeck (per player)",
        occurrences: players,
        estimatedGas: GAS_ESTIMATES.commitDeck,
        totalGas: GAS_ESTIMATES.commitDeck * BigInt(players)
    });

    actions.push({
        name: "revealDeck (per player)",
        occurrences: players,
        estimatedGas: GAS_ESTIMATES.revealDeck,
        totalGas: GAS_ESTIMATES.revealDeck * BigInt(players)
    });

    // ========== REVEAL PHASE ==========

    // Each player shares keys to all others
    actions.push({
        name: "shareKeysToAll (per player)",
        occurrences: players,
        estimatedGas: GAS_ESTIMATES.shareKeysToAll,
        totalGas: GAS_ESTIMATES.shareKeysToAll * BigInt(players)
    });

    // Each player commits and confirms role
    actions.push({
        name: "commitAndConfirmRole (per player)",
        occurrences: players,
        estimatedGas: GAS_ESTIMATES.commitAndConfirmRole,
        totalGas: GAS_ESTIMATES.commitAndConfirmRole * BigInt(players)
    });

    // ========== GAME ROUNDS (DAY + NIGHT cycles) ==========

    // startVoting (once per round)
    actions.push({
        name: "startVoting (per round)",
        occurrences: rounds,
        estimatedGas: GAS_ESTIMATES.startVoting,
        totalGas: GAS_ESTIMATES.startVoting * BigInt(rounds)
    });

    // Each alive player votes each round
    // Average alive players per round = players - round/2 (rough estimate)
    const avgAlivePerRound = Math.ceil(players - rounds / 2);
    actions.push({
        name: "vote (all alive players, per round)",
        occurrences: avgAlivePerRound * rounds,
        estimatedGas: GAS_ESTIMATES.vote,
        totalGas: GAS_ESTIMATES.vote * BigInt(avgAlivePerRound * rounds)
    });

    // ========== NIGHT PHASE ==========

    // Doctor action (1 doctor, each round)
    actions.push({
        name: "commitNightAction (doctor, per round)",
        occurrences: rounds,
        estimatedGas: GAS_ESTIMATES.commitNightAction,
        totalGas: GAS_ESTIMATES.commitNightAction * BigInt(rounds)
    });

    actions.push({
        name: "revealNightAction (doctor, per round)",
        occurrences: rounds,
        estimatedGas: GAS_ESTIMATES.revealNightAction,
        totalGas: GAS_ESTIMATES.revealNightAction * BigInt(rounds)
    });

    // Detective action (1 detective, each round)
    actions.push({
        name: "commitNightAction (detective, per round)",
        occurrences: rounds,
        estimatedGas: GAS_ESTIMATES.commitNightAction,
        totalGas: GAS_ESTIMATES.commitNightAction * BigInt(rounds)
    });

    actions.push({
        name: "revealNightAction (detective, per round)",
        occurrences: rounds,
        estimatedGas: GAS_ESTIMATES.revealNightAction,
        totalGas: GAS_ESTIMATES.revealNightAction * BigInt(rounds)
    });

    // Mafia commit/reveal (all mafia members each round)
    actions.push({
        name: "commitMafiaTarget (per mafia, per round)",
        occurrences: mafiaCount * rounds,
        estimatedGas: GAS_ESTIMATES.commitMafiaTarget,
        totalGas: GAS_ESTIMATES.commitMafiaTarget * BigInt(mafiaCount * rounds)
    });

    actions.push({
        name: "revealMafiaTarget (per mafia, per round)",
        occurrences: mafiaCount * rounds,
        estimatedGas: GAS_ESTIMATES.revealMafiaTarget,
        totalGas: GAS_ESTIMATES.revealMafiaTarget * BigInt(mafiaCount * rounds)
    });

    // endNight (once per round)
    actions.push({
        name: "endNight (per round)",
        occurrences: rounds,
        estimatedGas: GAS_ESTIMATES.endNight,
        totalGas: GAS_ESTIMATES.endNight * BigInt(rounds)
    });

    // ========== ENDGAME ==========

    // All surviving players reveal roles for ZK proof (approximate: 50% survive)
    const survivingPlayers = Math.ceil(players / 2);
    actions.push({
        name: "revealRole (per survivor for ZK)",
        occurrences: survivingPlayers,
        estimatedGas: GAS_ESTIMATES.revealRole,
        totalGas: GAS_ESTIMATES.revealRole * BigInt(survivingPlayers)
    });

    // ZK proof submission
    actions.push({
        name: "endGameZK (final ZK proof)",
        occurrences: 1,
        estimatedGas: GAS_ESTIMATES.endGameZK,
        totalGas: GAS_ESTIMATES.endGameZK
    });

    // ========== CALCULATE TOTALS ==========

    const totalGasUsed = actions.reduce((sum, a) => sum + a.totalGas, 0n);
    const totalCostWei = totalGasUsed * GAS_PRICE;
    const totalCostSTT = Number(totalCostWei) / 1e18;
    const perPlayerCostSTT = totalCostSTT / players;

    return {
        players,
        mafiaCount,
        townCount,
        rounds,
        actions,
        totalGasUsed,
        totalCostSTT: totalCostSTT.toFixed(6),
        perPlayerCostSTT: perPlayerCostSTT.toFixed(6)
    };
}

function formatNumber(n: bigint): string {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function printReport(report: GameCostReport): void {
    console.log("\n" + "=".repeat(70));
    console.log(`🎮 MAFIA GAME COST ANALYSIS - ${report.players} PLAYERS`);
    console.log("=".repeat(70));

    console.log(`\n📊 Game Parameters:`);
    console.log(`   Players: ${report.players} (${report.mafiaCount} Mafia, ${report.townCount} Town)`);
    console.log(`   Estimated Rounds: ${report.rounds}`);
    console.log(`   Gas Price: 10 gwei`);

    console.log(`\n📋 Action Breakdown:`);
    console.log("-".repeat(70));

    let phase = "";
    for (const action of report.actions) {
        const newPhase = action.name.includes("create") || action.name.includes("join") || action.name.includes("start") && !action.name.includes("Voting")
            ? "PRE-GAME"
            : action.name.includes("Deck")
                ? "SHUFFLE"
                : action.name.includes("share") || action.name.includes("confirm") || action.name.includes("commit") && action.name.includes("Role")
                    ? "REVEAL"
                    : action.name.includes("Vote") || action.name.includes("vote") || action.name.includes("Voting")
                        ? "DAY/VOTING"
                        : action.name.includes("Night") || action.name.includes("Mafia") || action.name.includes("doctor") || action.name.includes("detective")
                            ? "NIGHT"
                            : "ENDGAME";

        if (newPhase !== phase) {
            phase = newPhase;
            console.log(`\n  [${phase}]`);
        }

        console.log(`   • ${action.name.padEnd(40)} x${action.occurrences.toString().padStart(3)} = ${formatNumber(action.totalGas).padStart(12)} gas`);
    }

    console.log("\n" + "=".repeat(70));
    console.log(`💰 TOTAL COST SUMMARY`);
    console.log("=".repeat(70));
    console.log(`   Total Gas Used:        ${formatNumber(report.totalGasUsed)} gas`);
    console.log(`   Total Cost:            ${report.totalCostSTT} STT`);
    console.log(`   Per Player Cost:       ${report.perPlayerCostSTT} STT`);
    console.log("=".repeat(70));
}

// ========== RUN ANALYSIS ==========

console.log("🚀 Starting Mafia Game Cost Calculator...\n");

// Calculate for different player counts
const playerCounts = [4, 6, 8, 10, 12, 14, 16, 18, 20];

const allReports: GameCostReport[] = [];

for (const count of playerCounts) {
    const report = calculateGameCost(count);
    allReports.push(report);
    printReport(report);
}

// Summary table
console.log("\n\n" + "=".repeat(70));
console.log("📊 SUMMARY TABLE - ALL PLAYER COUNTS");
console.log("=".repeat(70));
console.log("Players | Mafia | Rounds | Total Gas        | Total STT   | Per Player STT");
console.log("-".repeat(70));

for (const r of allReports) {
    console.log(
        `${r.players.toString().padStart(7)} | ${r.mafiaCount.toString().padStart(5)} | ${r.rounds.toString().padStart(6)} | ${formatNumber(r.totalGasUsed).padStart(16)} | ${r.totalCostSTT.padStart(11)} | ${r.perPlayerCostSTT.padStart(14)}`
    );
}

console.log("\n\n📝 NOTES:");
console.log("   - These are ESTIMATES based on typical game scenarios");
console.log("   - Actual gas may vary based on calldata size, storage operations, etc.");
console.log("   - Session key funding should cover the 'Per Player Cost' shown above");
console.log("   - Add 20-50% buffer for safety margin");
console.log("");
console.log("⚠️  ROLE REVEAL AT END: YES!");
console.log("   - revealRole() is called by surviving players before endGameZK()");
console.log("   - This is required for the ZK proof to verify win conditions");
console.log("   - Each alive player must reveal their role on-chain");
