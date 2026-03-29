import { createWalletClient, createPublicClient, http, parseEther, formatEther, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";


// Define Somnia Testnet
const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'Somnia Test Token', symbol: 'STT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://dream-rpc.somnia.network/'] },
  },
  blockExplorers: {
    default: { name: 'Somnia Explorer', url: 'https://shannon-explorer.somnia.network' },
  },
});

// Manual ABI for the two functions we need
const MINIMAL_ABI = [
  {
    name: "getDefaultDeposit",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }]
  },
  {
    name: "setDefaultDeposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint128", name: "value" }],
    outputs: []
  }
] as const;

async function main() {
  const PRIVATE_KEY = "0xREDACTED_LEAKED_KEY";
  const DIAMOND_ADDRESS = "0xe5437f7857cf7abe40de67e8f462b87f9c8eecc8";
  
  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  const client = createWalletClient({
    account,
    chain: somniaTestnet,
    transport: http()
  });
  
  const publicClient = createPublicClient({
    chain: somniaTestnet,
    transport: http()
  });

  console.log("Checking Diamond at:", DIAMOND_ADDRESS);
  console.log("Admin address:", account.address);

  try {
    const currentDeposit = await publicClient.readContract({
      address: DIAMOND_ADDRESS as `0x${string}`,
      abi: MINIMAL_ABI,
      functionName: 'getDefaultDeposit'
    });
    
    console.log("Current Default Deposit:", formatEther(currentDeposit), "STT");

    // Check Room 24 explicitly
    try {
      const room24 = await publicClient.readContract({
        address: DIAMOND_ADDRESS as `0x${string}`,
        abi: [
          {
            name: "getRoom",
            type: "function",
            stateMutability: "view",
            inputs: [{ type: "uint256", name: "roomId" }],
            outputs: [{ type: "tuple", components: [
              { name: "id", type: "uint64" },
              { name: "host", type: "address" },
              { name: "name", type: "string" },
              { name: "phase", type: "uint8" },
              { name: "maxPlayers", type: "uint8" },
              { name: "playersCount", type: "uint8" },
              { name: "aliveCount", type: "uint8" },
              { name: "dayCount", type: "uint8" },
              { name: "currentShufflerIndex", type: "uint8" },
              { name: "lastActionTimestamp", type: "uint32" },
              { name: "phaseDeadline", type: "uint32" },
              { name: "confirmedCount", type: "uint8" },
              { name: "votedCount", type: "uint8" },
              { name: "committedCount", type: "uint8" },
              { name: "revealedCount", type: "uint8" },
              { name: "keysSharedCount", type: "uint8" },
              { name: "depositPool", type: "uint256" },
              { name: "depositPerPlayer", type: "uint256" },
              { name: "isPrivate", type: "bool" },
              { name: "tournamentId", type: "uint256" }
            ]}]
          }
        ],
        functionName: 'getRoom',
        args: [24n]
      }) as any;
      console.log("Room 24 Deposit Required:", formatEther(room24.depositPerPlayer), "STT");
      console.log("Room 24 Players Count:", room24.playersCount);
    } catch (re) {
      console.warn("Failed to fetch Room 24 info (might not exist yet)");
    }

    if (currentDeposit > 0n) {
      console.log("Setting default deposit to 0...");
      const hash = await client.writeContract({
        address: DIAMOND_ADDRESS as `0x${string}`,
        abi: MINIMAL_ABI,
        functionName: 'setDefaultDeposit',
        args: [0n]
      });
      console.log("Transaction sent:", hash);
      await publicClient.waitForTransactionReceipt({ hash });
      console.log("✅ Default deposit set to 0. All future joins will fund session 100%.");
    } else {
      console.log("✅ Default deposit is already 0.");
    }
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

main().catch(console.error);
