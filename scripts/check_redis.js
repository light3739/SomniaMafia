const Redis = require('ioredis');

async function checkRedis() {
    console.log("--- REDIS DIAGNOSTIC ---");

    // Use REDIS_URL from env or fallback to localhost
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    console.log(`Connecting to: ${redisUrl}`);

    const redis = new Redis(redisUrl, {
        connectTimeout: 5000,
        maxRetriesPerRequest: 1
    });

    try {
        await redis.ping();
        console.log("✅ [SUCCESS] Redis is ALIVE (PING successful)");

        // Test Write
        await redis.set('test_key', 'test_value', 'EX', 10);
        console.log("✅ [SUCCESS] Data WRITE successful");

        // Test Read
        const val = await redis.get('test_key');
        if (val === 'test_value') {
            console.log("✅ [SUCCESS] Data READ successful");
        } else {
            console.log(`❌ [FAILURE] Data READ mismatch: expected 'test_value', got '${val}'`);
        }

        // Clean up
        await redis.del('test_key');
        console.log("✅ [SUCCESS] Cleanup successful");

    } catch (e) {
        console.error("❌ [FAILURE] Redis error:", e.message);
        if (e.code === 'ECONNREFUSED') {
            console.log("\nTIP: Redis is not running locally. If you are using Upstash, make sure REDIS_URL is in your .env file.");
        }
    } finally {
        redis.disconnect();
        process.exit();
    }
}

checkRedis();
