const binance = require('./binance-api-wrapper');
const storage = require('../storage/storage-service');

const ACTIVE_VIRTUAL_ORDERS_KEY = 'ACTIVE_VIRTUAL_ORDERS';

module.exports = {
    getActiveVirtualOrders,
    whenPriceLessOrEqual,
    whenPriceGreaterOrEqual
}

let activeVirtualOrders = [];

init();

function init() {
    storage.getObject(ACTIVE_VIRTUAL_ORDERS_KEY)
        .then((value) => {
            if (Array.isArray(value)) {
                activeVirtualOrders = value;
            }
        });
}

function getActiveVirtualOrders() {
    return activeVirtualOrders;
}

function whenPriceLessOrEqual(symbol, levelPrice) {
    return new Promise((resolve) => {
        const identifier = binance.subscribeOnPriceChange(symbol, (watchedSymbol, currentPrice) => {
            if (watchedSymbol === symbol && Number(currentPrice) <= Number(levelPrice)) {
                resolve();

                binance.unsubscribeOnPriceChange(identifier);
            }
        });

        activeVirtualOrders.push({
            id: identifier,
            symbol,
            type: 'whenPriceLessOrEqual',
            price: levelPrice
        });

        storage.setObject(ACTIVE_VIRTUAL_ORDERS_KEY, activeVirtualOrders);
    });
}

function whenPriceGreaterOrEqual(symbol, levelPrice) {
    return new Promise((resolve) => {
        const identifier = binance.subscribeOnPriceChange(symbol, (watchedSymbol, currentPrice) => {
            if (watchedSymbol === symbol && Number(currentPrice) >= Number(levelPrice)) {
                resolve();

                binance.unsubscribeOnPriceChange(identifier);
            }
        });

        activeVirtualOrders.push({
            id: identifier,
            symbol,
            type: 'whenPriceGreaterOrEqual',
            price: levelPrice
        });

        storage.setObject(ACTIVE_VIRTUAL_ORDERS_KEY, activeVirtualOrders);
    });
}