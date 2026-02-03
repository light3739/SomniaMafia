// scripts/test_voice_chat.js
// Test script to verify voice chat integration and SFU connection

const chalk = require('chalk');

const SFU_URL = process.env.NEXT_PUBLIC_SFU_URL || 'https://mafia-voice.serveminecraft.net';
const SFU_API_SECRET = process.env.SFU_API_SECRET || 'mafia_api_secret_2026_change_this';

console.log(chalk.blue.bold('\n🎙️  Voice Chat Integration Test\n'));

async function testSFUConnection() {
    console.log(chalk.yellow('1. Testing SFU Server Connection...'));

    try {
        const response = await fetch(`${SFU_URL}/api/v1/stats`, {
            headers: {
                'authorization': SFU_API_SECRET
            }
        });

        if (response.ok) {
            const stats = await response.json();
            console.log(chalk.green('   ✅ SFU Server is reachable'));
            console.log(chalk.gray(`   Stats: ${JSON.stringify(stats, null, 2)}`));
            return true;
        } else {
            console.log(chalk.red(`   ❌ SFU returned status: ${response.status}`));
            return false;
        }
    } catch (error) {
        console.log(chalk.red('   ❌ Cannot reach SFU server'));
        console.log(chalk.gray(`   Error: ${error.message}`));
        return false;
    }
}

async function testJoinAPI() {
    console.log(chalk.yellow('\n2. Testing /api/v1/join endpoint...'));

    try {
        const response = await fetch(`${SFU_URL}/api/v1/join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'authorization': SFU_API_SECRET
            },
            body: JSON.stringify({
                room: 'test-room-123',
                name: 'TestPlayer',
                audio: true,
                video: false,
                screen: false,
                chat: false,
                token: {
                    username: 'test',
                    password: '',
                    presenter: false,
                    expire: '1h'
                }
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log(chalk.green('   ✅ Join endpoint works'));
            console.log(chalk.gray(`   Join URL: ${data.join}`));
            return true;
        } else {
            const error = await response.text();
            console.log(chalk.red(`   ❌ Join failed: ${response.status}`));
            console.log(chalk.gray(`   Response: ${error}`));
            return false;
        }
    } catch (error) {
        console.log(chalk.red('   ❌ Join API request failed'));
        console.log(chalk.gray(`   Error: ${error.message}`));
        return false;
    }
}

async function testNextJSAPI() {
    console.log(chalk.yellow('\n3. Testing Next.js API route /api/voice/room...'));

    // This assumes Next.js is running on localhost:3000
    const NEXTJS_URL = 'http://localhost:3000';

    try {
        const response = await fetch(`${NEXTJS_URL}/api/voice/room`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                roomId: 'test-room-456',
                userName: 'TestPlayer2'
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log(chalk.green('   ✅ Next.js API route works'));
            console.log(chalk.gray(`   Join URL: ${data.joinUrl}`));
            return true;
        } else {
            const error = await response.text();
            console.log(chalk.red(`   ❌ API route failed: ${response.status}`));
            console.log(chalk.gray(`   Response: ${error}`));
            console.log(chalk.yellow('   ℹ️  Make sure Next.js dev server is running (npm run dev)'));
            return false;
        }
    } catch (error) {
        console.log(chalk.red('   ❌ Cannot reach Next.js server'));
        console.log(chalk.gray(`   Error: ${error.message}`));
        console.log(chalk.yellow('   ℹ️  Run "npm run dev" to start the server'));
        return false;
    }
}

async function checkDependencies() {
    console.log(chalk.yellow('\n4. Checking npm dependencies...'));

    const fs = require('fs');
    const path = require('path');

    try {
        const packageJson = JSON.parse(
            fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
        );

        const required = ['mediasoup-client', 'socket.io-client'];
        const missing = [];

        for (const dep of required) {
            if (packageJson.dependencies[dep]) {
                console.log(chalk.green(`   ✅ ${dep}: ${packageJson.dependencies[dep]}`));
            } else {
                console.log(chalk.red(`   ❌ ${dep}: NOT INSTALLED`));
                missing.push(dep);
            }
        }

        if (missing.length > 0) {
            console.log(chalk.yellow(`\n   ℹ️  Install missing: npm install ${missing.join(' ')}`));
            return false;
        }

        return true;
    } catch (error) {
        console.log(chalk.red('   ❌ Cannot read package.json'));
        return false;
    }
}

async function checkComponentIntegration() {
    console.log(chalk.yellow('\n5. Checking component integration...'));

    const fs = require('fs');
    const path = require('path');

    const checks = [
        {
            file: 'components/game/VoiceChatCustom.tsx',
            pattern: /import.*mediasoup-client/,
            name: 'VoiceChatCustom component'
        },
        {
            file: 'components/game/DayPhase.tsx',
            pattern: /import.*VoiceChat.*from.*VoiceChatCustom/,
            name: 'DayPhase integration'
        },
        {
            file: 'app/api/voice/room/route.ts',
            pattern: /fetch.*\/join/,
            name: 'API route'
        }
    ];

    let allGood = true;

    for (const check of checks) {
        try {
            const filePath = path.join(process.cwd(), check.file);
            const content = fs.readFileSync(filePath, 'utf8');

            if (check.pattern.test(content)) {
                console.log(chalk.green(`   ✅ ${check.name}`));
            } else {
                console.log(chalk.red(`   ❌ ${check.name} - pattern not found`));
                allGood = false;
            }
        } catch (error) {
            console.log(chalk.red(`   ❌ ${check.name} - file not found`));
            allGood = false;
        }
    }

    return allGood;
}

async function checkEnvVariables() {
    console.log(chalk.yellow('\n6. Checking environment variables...'));

    const required = {
        'NEXT_PUBLIC_SFU_URL': SFU_URL,
        'SFU_API_SECRET': SFU_API_SECRET
    };

    let allSet = true;

    for (const [key, value] of Object.entries(required)) {
        if (value && value !== 'undefined') {
            console.log(chalk.green(`   ✅ ${key}: ${value.substring(0, 30)}...`));
        } else {
            console.log(chalk.red(`   ❌ ${key}: NOT SET`));
            allSet = false;
        }
    }

    if (!allSet) {
        console.log(chalk.yellow('\n   ℹ️  Create .env.local with:'));
        console.log(chalk.gray('   NEXT_PUBLIC_SFU_URL=https://mafia-voice.serveminecraft.net'));
        console.log(chalk.gray('   SFU_API_SECRET=your_secret_here'));
    }

    return allSet;
}

async function runTests() {
    console.log(chalk.cyan('═'.repeat(60)));

    const results = {
        env: await checkEnvVariables(),
        deps: await checkDependencies(),
        components: await checkComponentIntegration(),
        sfu: await testSFUConnection(),
        join: await testJoinAPI(),
        nextjs: await testNextJSAPI()
    };

    console.log(chalk.cyan('\n═'.repeat(60)));
    console.log(chalk.blue.bold('\n📊 Test Results Summary:\n'));

    const passed = Object.values(results).filter(Boolean).length;
    const total = Object.keys(results).length;

    for (const [test, result] of Object.entries(results)) {
        const icon = result ? '✅' : '❌';
        const color = result ? chalk.green : chalk.red;
        console.log(color(`${icon} ${test.toUpperCase()}`));
    }

    console.log(chalk.cyan('\n═'.repeat(60)));

    if (passed === total) {
        console.log(chalk.green.bold('\n🎉 All tests passed! Voice chat is ready.\n'));
        console.log(chalk.yellow('Next steps:'));
        console.log(chalk.gray('1. Start the dev server: npm run dev'));
        console.log(chalk.gray('2. Create a game and enter Day Phase'));
        console.log(chalk.gray('3. Look for the voice chat component'));
        console.log(chalk.gray('4. Allow microphone access when prompted'));
    } else {
        console.log(chalk.red.bold(`\n⚠️  ${total - passed} test(s) failed. Fix issues above.\n`));
    }

    console.log(chalk.cyan('═'.repeat(60) + '\n'));
}

// Handle missing chalk gracefully
if (require.main === module) {
    runTests().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}
