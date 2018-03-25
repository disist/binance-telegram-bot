const REDIS_URL = process.env.REDIS_URL;

const redis = require('redis');
const client = redis.createClient({
    url: REDIS_URL
});

client.on('error', (err) => {
    console.log('Redis error >>', err);
});

module.exports = {
    get,
    set,
    deleteItem
}

function get(key) {
    return new Promise((resolve, rejection) => {
        client.get(key, (err, reply) => {
            if (err) {
                rejection(err);
                return;
            }
            resolve(reply);
        })
    });
}

function set(key, value) {
    return new Promise((resolve, rejection) => {
        client.set(key, value, (err, reply) => {
            if (err) {
                rejection(err);
                return;
            }
            resolve(reply);
        })
    });
}

function deleteItem(key) {
    return new Promise((resolve, rejection) => {
        client.del(key, (err, reply) => {
            if (err) {
                rejection(err);
                return;
            }
            resolve(reply);
        })
    });
}