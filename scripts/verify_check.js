const snarkjs = require('snarkjs');
const fs = require('fs');

async function verify() {
    const vKey = JSON.parse(fs.readFileSync('verification_key.json'));

    // Values decoded from the failed transaction
    const publicSignals = [
        "1", // townWin
        "0", // mafiaWin
        "13", // roomId
        "0", // mafiaCount
        "4" // townCount
    ];

    // Reconstruction of proof object structure from decoded logs is hard without full pi_a/b/c points
    // But wait, the decoded input gave us the exact A/B/C points!

    // Copy-paste from the output of Step 376
    const proof = {
        pi_a: [
            "9324977034140016670121918624489455465674852522378762017510727488208209718296",
            "3924268532260025484085653018655556089011959852101303990254423277797637981353",
            "1"
        ],
        pi_b: [
            [
                "12533193276670182861893003564464200240591613792432233113414686127537899000914",
                "11236915446076300321849444722517743440501116268285973208754361037866226606605"
            ],
            [
                "20073092384652828446145938591511148350991310540437045551585323499604365959887",
                "16552947202634564580900437318535637093233240335240218844894083130816569029129"
            ],
            [
                "1",
                "0"
            ]
        ],
        pi_c: [
            "810124481476484431470038750693963904101418669202527155932317702891451326043",
            "19085731144622948333690157161425616423956760820766432968175328502303980584628",
            "1"
        ],
        protocol: "groth16",
        curve: "bn128"
    };

    try {
        const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        console.log("Local Verification Result:", res);
    } catch (e) {
        console.error("Verification Error:", e);
    }
}

verify();
