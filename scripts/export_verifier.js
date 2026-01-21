const snarkjs = require('snarkjs');
const fs = require('fs');

async function main() {
    try {
        const templates = {
            groth16: require('snarkjs/src/groth16_templates')
        };
        // Note: In newer snarkjs versions, templates might be bundled differently or not exposed this way
        // Let's rely on the default export function which handles templates internally if not provided?
        // Actually snarkjs.zKey.exportSolidityVerifier source code typically loads templates from file system

        console.log("Exporting Verifier...");
        const code = await snarkjs.zKey.exportSolidityVerifier('public/mafia_outcome_0001.zkey', templates);
        fs.writeFileSync('Verifier_new.sol', code);
        console.log("Verifier_new.sol created!");
    } catch (e) {
        console.error("Export Failed:", e);
    }
}

main();
