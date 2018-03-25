const binance = require('./binance-api-wrapper');

module.exports = {
    getActiveVirtualOrders,
    whenPriceLessOrEqual,
    whenPriceGreaterOrEqual
}

let activeVirtualOrders = [];

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
    });
}

const storage = require('node-persist');

storage.init({
    dir: './simple-storage',
}).then(() => {
    storage.getItem('TEST')
        .then((value) => {
            console.log('TEST', value);

            return storage.setItem('TEST', 'it is test message');
        })
        .then(() => {
            return storage.getItem('TEST');
        })
        .then((value) => {
            console.log('TEST', value);
        })
        .catch((rejection) => console.log('rejection', rejection));



});