const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

const proof = {
    pi_a: [
        '11975660473871303226173926429707722678248490630867462292794300277773261287440',
        '12446877952699380671361283009424816936463484147502324644263767224641647446658',
        '1'
    ],
    pi_b: [
        [
            '9468063335393282142539252689840521461941609201615599875592909809004491034643',
            '2442393829545014025202832358236197837461587755852618308322755137984305589893'
        ],
        [
            '15214308445661509435567024932399918742813675540908339803248810689702889939102',
            '14758684769068215772660198314829127437133805761383795235907051865793610781046'
        ],
        ['1', '0']
    ],
    pi_c: [
        '3687118008031263637216229851340624032705789411500985395310994273567237593409',
        '15125248134231556357907036717024328733953300606479927800799515798971185625816',
        '1'
    ],
    protocol: "groth16",
    curve: "bn128"
};

const publicSignals = [
    "1", "0", "16", "0", "4"
];

async function run() {
    try {
        console.log("Loading verification key...");
        // Since we don't have the original verification_key.json that matches the ZKey, 
        // we should try to export it from the ZKey OR use the one we likely have if it exists.
        // Actually, Step 441 confirmed we exported export_verifier.js.
        // Let's rely on snarkjs checking against the .zkey file directly or export vkey first.

        // Export vkey from zkey
        // exec is sync in node usually, but snarkjs has a CLI.
        // We will assume 'verification_key.json' is already good from previous steps OR export it.
        // Let's use the .zkey directly if possible, or export.

        // Better: Export verification key first to be sure.
        const zkeyPath = path.join(process.cwd(), 'public', 'mafia_outcome_0001.zkey');
        const vKey = await snarkjs.zKey.exportVerificationKey(zkeyPath);

        console.log("Verifying proof...");
        const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);

        if (res === true) {
            console.log("Verification OK");
        } else {
            console.log("Invalid proof");
        }

    } catch (e) {
        console.log("Error:", e);
    }
}

run().then(() => {
    process.exit(0);
});
