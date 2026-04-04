import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { somniaTestnet } from 'viem/chains';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAFIA_DIAMOND = '0x0406a14729b0c77c187ac5229c8c2317589e73c0';

const client = createPublicClient({
  chain: somniaTestnet,
  transport: http('https://dream-rpc.somnia.network/')
});

// Using the same pk as before
const ownerPk = '0xREDACTED_LEAKED_KEY';
const ownerAccount = privateKeyToAccount(ownerPk);

const wallet = createWalletClient({
    account: ownerAccount,
    chain: somniaTestnet,
    transport: http('https://dream-rpc.somnia.network/')
});

// Read the compiled Verifier bytecode
const artifactPath = path.join(__dirname, '../../SomniaSol/artifacts/contracts/Verifier.sol/Groth16Verifier.json');
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

async function main() {
    console.log("Deploying new Groth16Verifier...");
    
    const deployHash = await wallet.deployContract({
      abi: artifact.abi,
      bytecode: artifact.bytecode,
    });
    console.log("Deploy tx:", deployHash);
    
    const receipt = await client.waitForTransactionReceipt({ hash: deployHash });
    const verifierAddress = receipt.contractAddress;
    console.log("Deployed new Groth16Verifier to:", verifierAddress);
    
    console.log(`Setting zkVerifier(${verifierAddress})...`);
    
    const { request } = await client.simulateContract({
        account: ownerAccount,
        address: MAFIA_DIAMOND,
        abi: parseAbi(['function setZkVerifier(address v) external']),
        functionName: 'setZkVerifier',
        args: [verifierAddress]
    });
    
    console.log('Simulate OK! TX sending...');
    const hash = await wallet.writeContract(request);
    console.log('Tx sent: ', hash);
    
    const receipt2 = await client.waitForTransactionReceipt({ hash });
    console.log('Success block: ', receipt2.blockNumber);
    
    const configPath = path.join(__dirname, 'contracts/config.ts');
    let config = fs.readFileSync(configPath, 'utf8');
    const oldVerifier = '0xfb34816ff23a915b21987eff76b336be7a609eb6'; // previous one
    config = config.replace(new RegExp(oldVerifier, 'gi'), verifierAddress);
    fs.writeFileSync(configPath, config);
    console.log("Updated frontend config.ts too!");
}
main().catch(console.error);
