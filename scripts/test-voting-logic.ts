
// Mock React state management for a node script
class GameContextLogic {
    phase: string;
    prevPhase: string;
    showVotingResults: boolean;

    constructor(initialPhase: string) {
        this.phase = initialPhase;
        this.prevPhase = initialPhase;
        this.showVotingResults = false;
    }

    // This simulates the setGameState update which triggers the effect
    setPhase(newPhase: string) {
        // Run the "useLayoutEffect" logic synchronously BEFORE painting (in our case, before returning)

        // LOGIC FROM GameContext.tsx:
        if (this.prevPhase === 'VOTING' && newPhase === 'NIGHT') {
            this.showVotingResults = true;
        }

        // Commit phase update
        this.prevPhase = newPhase;
        this.phase = newPhase;
    }
}

// Test Suite
function runTests() {
    console.log("Running Voting Results Logic Tests...");
    let passed = 0;
    let failed = 0;

    // Test 1: VOTING -> NIGHT
    try {
        const game = new GameContextLogic('VOTING');
        if (game.phase !== 'VOTING') throw new Error("Initial phase correct");
        if (game.showVotingResults !== false) throw new Error("Initial showVotingResults correct");

        console.log("Test 1: Transitioning VOTING -> NIGHT");
        game.setPhase('NIGHT');

        if (game.phase !== 'NIGHT') throw new Error("Phase updated to NIGHT");
        if (game.showVotingResults !== true) throw new Error("showVotingResults should be TRUE immediately");

        console.log("PASS: Test 1");
        passed++;
    } catch (e: any) {
        console.error("FAIL: Test 1 - " + e.message);
        failed++;
    }

    // Test 2: DAY -> NIGHT
    try {
        const game = new GameContextLogic('DAY');
        console.log("Test 2: Transitioning DAY -> NIGHT");
        game.setPhase('NIGHT');

        if (game.showVotingResults !== false) throw new Error("showVotingResults should be FALSE");

        console.log("PASS: Test 2");
        passed++;
    } catch (e: any) {
        console.error("FAIL: Test 2 - " + e.message);
        failed++;
    }

    console.log(`\nResults: ${passed} Passed, ${failed} Failed`);
    if (failed > 0) process.exit(1);
}

runTests();
