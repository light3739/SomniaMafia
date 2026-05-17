import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'node:fs';

const env = readFileSync('../.env', 'utf8');
const m = env.match(/^LLM_AGENT_PRIVATE_KEY=([^\r\n]+)/m);
if (!m) { console.error('LLM_AGENT_PRIVATE_KEY not found'); process.exit(1); }
const hex = m[1].trim().match(/^(0x)?[a-fA-F0-9]{64}/);
if (!hex) { console.error('value present but not 64-hex'); process.exit(1); }
const pk = (hex[0].startsWith('0x') ? hex[0] : '0x' + hex[0]) as `0x${string}`;
console.log('Agent address:', privateKeyToAccount(pk).address);
