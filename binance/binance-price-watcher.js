const binance = require('./binance-api-wrapper');

module.exports = {
    whenPriceLessOrEqual
}

function whenPriceLessOrEqual(symbol, levelPrice) {
    return new Promise((resolve) => {
        binance.watchPrice(symbol, (watchedSymbol, currentPrice) => {
            if (watchedSymbol === symbol && currentPrice <= levelPrice) {
                resolve();
            }
        });
    });
}