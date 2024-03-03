const { createClient } = require('redis');


const client = createClient({
    url: 'redis://localhost:6379'
});

client.on('error', (err) => console.error('Redis Client Error', err));

client.connect();


async function getAsync(key) {
    try {
        return await client.get(key);
    } catch (error) {
        console.error(`Error getting key ${key} from Redis`, error);
        throw error;
    }
}

async function setAsync(key, value, expiration) {
    try {
        return await client.set(key, value, { EX: expiration });
    } catch (error) {
        console.error(`Error setting key ${key} in Redis`, error);
        throw error;
    }
}

module.exports = { getAsync, setAsync };
