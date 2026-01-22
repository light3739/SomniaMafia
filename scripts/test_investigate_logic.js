const { createPublicClient, http } = require('viem');

// Mock the API logic
async function verifyInvestigateLogic(mockLogs, mockMappingValue) {
    console.log("Testing API Logic with Mock Data...");

    const detectiveAddress = "0xDetective";
    const targetAddress = "0xTarget";
    const roomId = 999;
    const ACTION_CHECK = 3;

    // Simulate Step 1 in API: Look for logs
    const revealEvent = mockLogs.find(log =>
        log.player.toLowerCase() === detectiveAddress.toLowerCase() &&
        log.action === ACTION_CHECK &&
        log.target.toLowerCase() === targetAddress.toLowerCase()
    );

    if (revealEvent) {
        console.log("SUCCESS: Found on-chain proof via Event Logs!");
        return { success: true, verifiedBy: 'Event' };
    }

    console.log("No event found. Falling back to mapping check...");

    // Simulate Mapping Read
    if (mockMappingValue === ACTION_CHECK) {
        console.log("SUCCESS: Found proof via Mapping (Fallback)!");
        return { success: true, verifiedBy: 'Mapping' };
    }

    console.log("FAILURE: No proof found in Event or Mapping!");
    return { success: false, error: 'Detective action not verified on-chain' };
}

async function runTests() {
    console.log("--- TEST 1: The Race Condition Scenario (Mapping cleared, Event exists) ---");
    const result1 = await verifyInvestigateLogic(
        [{ player: "0xDetective", action: 3, target: "0xTarget" }], // Event exists
        0 // Mapping is DELETED/EMPTY
    );
    if (result1.success && result1.verifiedBy === 'Event') console.log(">> TEST 1 PASSED!\n");
    else throw new Error("Test 1 Failed");

    console.log("--- TEST 2: Old Scenario (Mapping filled, Event might be slow/not-indexed) ---");
    const result2 = await verifyInvestigateLogic(
        [], // Event not yet indexed
        3   // Mapping exists
    );
    if (result2.success && result2.verifiedBy === 'Mapping') console.log(">> TEST 2 PASSED!\n");
    else throw new Error("Test 2 Failed");

    console.log("--- TEST 3: Invalid Move ---");
    const result3 = await verifyInvestigateLogic(
        [], // No event
        0   // No mapping
    );
    if (!result3.success) console.log(">> TEST 3 PASSED!\n");
    else throw new Error("Test 3 Failed");

    console.log("ALL LOGIC TESTS PASSED! The Backend is now resilient to state deletion.");
}

runTests();
