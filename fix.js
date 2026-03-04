const fs = require('fs');
const files = [
    'components/game/ShufflePhase.tsx',
    'components/game/NightPhase.tsx',
    'components/game/GameOver.tsx',
    'components/game/DayPhase.tsx'
];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    content = content.replace(/address:\s*MAFIA_CONTRACT_ADDRESS/g, 'address: runtimeContractAddress');
    content = content.replace(/import \{ MAFIA_CONTRACT_ADDRESS, MAFIA_ABI \} from '\.\.\/\.\.\/contracts\/config';/g, "import { MAFIA_ABI } from '../../contracts/config';");

    if (!content.includes('runtimeContractAddress')) {
        content = content.replace(/} = useGameContext\(\);/, '    runtimeContractAddress,\n    } = useGameContext();');
    }

    fs.writeFileSync(file, content);
    console.log('Fixed', file);
});
