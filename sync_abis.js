
const fs = require('fs');

const abi = fs.readFileSync('contracts/MafiaDiamondABI.json', 'utf8');
const portalTs = `export const MafiaABI = ${abi};`;
fs.writeFileSync('contracts/MafiaPortal.ts', portalTs);
console.log('Synced MafiaPortal.ts');
