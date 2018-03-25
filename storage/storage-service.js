const redisClient = require('./redis-client');

module.exports = {
    get: redisClient.get,
    getObject,
    set: redisClient.set,
    setObject,
    deleteItem: redisClient.deleteItem
}

function getObject(key) {
    return redisClient.get(key)
        .then((value) => JSON.parse(value));
}

function setObject(key, value) {
    return redisClient.set(key, JSON.stringify(value));
}