const { decodeFunctionData } = require('viem');
const { abi } = require('../contracts/MafiaPortal.json'); // Corrected path

const inputData = "0x34ad36f600000000000000000000000000000000000000000000000000000000000000101a79fbcee1dce400555f9ad1ef8e9a41b0b90412a2254d772884a52e19d730101b84aeea970f9d80e62b7dfcbc3e225234445ee7797650fade4fd59d9a8e8a820566588e26453857ce406ec60214ce68e00b59a10a05c8506e9fc87add386e8514eebbe3965f136148df02dcbf35df326cd694af9f996c734ebd25967143d01320a11e9b37002447d2ff8b44156a9b61fdb47e7a58523f38ec6b637bdb56117621a2fe50a6aa11504a3acaff73e347c2e5ac98c99d75a7b544ba28b0df92609e0826d5b7efdf2d5723b9d7dd2c84bf2626fdc8cadfb8b2caf84c59a22db9d9412170964a1a05d26312a3c73000ea72c0e0bcb954f947764d1e9f93393123fad800000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004";

try {
    const decoded = decodeFunctionData({
        abi,
        data: inputData
    });
    console.log("Decoded Input:");
    console.log("RoomID:", decoded.args[0].toString());
    console.log("A:", decoded.args[1].map(x => x.toString()));
    console.log("B:", decoded.args[2].map(row => row.map(x => x.toString())));
    console.log("C:", decoded.args[3].map(x => x.toString()));
    console.log("Inputs (Public Signals):", decoded.args[4].map(x => x.toString()));

    // Expected Public Signals structure:
    // [townWin, mafiaWin, roomId, mafiaCount, townCount]
    const inputs = decoded.args[4];
    console.log("\nParsed Public Signals:");
    console.log("- Town Win:", inputs[0].toString());
    console.log("- Mafia Win:", inputs[1].toString());
    console.log("- Proof Room ID:", inputs[2].toString());
    console.log("- Mafia Count:", inputs[3].toString());
    console.log("- Town Count:", inputs[4].toString());

} catch (e) {
    console.error("Decode Error:", e);
}
