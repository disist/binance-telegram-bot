const REDIS_URL = process.env.REDIS_URL;

const redis = require('redis');
const client = redis.createClient({
    url: REDIS_URL
});
 
client.on('error', (err) => console.log('Redis error >>', err));

client.get('TEST', (err, reply) => {
    // reply is null when the key is missing 
    console.log('>> TEST', reply);

    client.set('TEST', 'It is first test value message in storsage', (err, reply) => {
        console.log('TEST', reply);
    });
});