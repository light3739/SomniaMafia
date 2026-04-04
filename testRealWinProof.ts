import { createPublicClient, http, parseAbi } from 'viem';
import { somniaTestnet } from 'viem/chains';

const verifierAddress = '0xe0fb727e1bd7bfcfc8a71d8e3f10d3c8959ff001';

const client = createPublicClient({
  chain: somniaTestnet,
  transport: http('https://dream-rpc.somnia.network')
});

async function main() {
    console.log("Checking the real proof against the on-chain Verifier...");
    
    // Extracted from the backend simulation
    const cdRaw = `["0x13f6786cf567d8bd2ae0890096f5299525c81071d4fcea2a42178fb2f9c9285d", "0x29c25d8bd25dca013a79d2c64c1217060ce99bd2db4496d5b83b70231d208730"],[["0x01c80cb80d5dd101da2e09a1d65c9d4d8a483c3e896738339f73ac121faebc8a", "0x14678c8f8534a02d6bba08c9d16b978a00344fad7358595ffd9325555fa7eaf4"],["0x246f2d78529589d99fe42fea9a2c0bb93401f3230c068025626c4c3e973b6f6f", "0x207d0b77594f30c7ac521496a9b8301980e0408fcdbe599e00058ca98fc6cf3d"]],["0x13f61e31183588f69feb71110ba3aa3ecb002dba63858673566630df956d9dc6", "0x0372bc069843bd981881c6d003efb1433bc305e87e0f201c51949915a5b06f8e"],["0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000001","0x0000000000000000000000000000000000000000000000000000000000007a69","0x0000000000000000000000000000000000000000000000000000000000000001","0x0000000000000000000000000000000000000000000000000000000000000001"]`;
    
    // Parse it exactly like the frontend backend does
    const argv = cdRaw.replace(/["\[\]\s]/g, "").split(",");
    
    const args = [
        [argv[0], argv[1]],
        [
            [argv[2], argv[3]],
            [argv[4], argv[5]]
        ],
        [argv[6], argv[7]],
        argv.slice(8)
    ];

    try {
        const result = await client.readContract({
            address: verifierAddress,
            abi: parseAbi([
                'function verifyProof(uint256[2],uint256[2][2],uint256[2],uint256[5]) view returns (bool)'
            ]),
            functionName: 'verifyProof',
            args: args as any
        });
        console.log("Proof verification result: ", result);
        if (result === true) {
            console.log("SUCCESS! The generated proof from backend is valid on-chain!");
        } else {
            console.error("FAIL! Verifier returned false.");
        }
    } catch (e: any) {
        console.error("FAIL: Revert checking the proof.");
        console.error(e.shortMessage || e.message);
    }
}
main();
