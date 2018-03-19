const binance = require('node-binance-api');

const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const BINANCE_API_SECRET = process.env.BINANCE_API_SECRET;
const BINANCE_TEST_MODE = process.env.BINANCE_TEST_MODE === 'true';
console.log('BINANCE_TEST_MODE', BINANCE_TEST_MODE);

let binanceExchangeInfo;

module.exports = {
    getOpenOrders,
    getLatestPrices,
    getLatestPriceForSymbol,
    getTradeHistoryBySymbol,
    getBalance,
    marketBuy,
    marketSell,
    limitBuy,
    limitSell,
    cancelLimitOrder,
    cancelLimitOrders,
    watchPrice,
    getExchangeInfo,
    roundStep: binance.roundStep.bind(binance)
}

initBinance();

function initBinance() {
    // Init binance options
    binance.options({
        APIKEY: BINANCE_API_KEY,
        APISECRET: BINANCE_API_SECRET,
        useServerTime: true,
        test: BINANCE_TEST_MODE
    });

    // Get and store a current binance exchange info
    // ToDo: Implement updating some time (once a day)
    fetchExchangeInfo()
        .then((exchangeInfo) => binanceExchangeInfo = exchangeInfo);
}

function getExchangeInfo() {
    return binanceExchangeInfo;
}

// Binance API promise wrappers

function getOpenOrders() {
    return new Promise((resolve, rejection) => {
        binance.openOrders(false, (error, openOrders) => {
            if (error) {
                rejection(error);
                return;
            }
            resolve(openOrders);
        });
    });
}

function getLatestPrices() {
    return new Promise((resolve, rejection) => {
        binance.prices((error, ticker) => {
            if (error) {
                rejection(error);
                return;
            }
            resolve(ticker);
        });
    });
}

function getLatestPriceForSymbol(symbol) {
    return new Promise((resolve, rejection) => {
        binance.prices(symbol, (error, ticker) => {
            if (error) {
                rejection(error);
                return;
            }
            resolve(ticker[symbol]);
        });
    });
}

function getTradeHistoryBySymbol(currencyCode) {
    return new Promise((resolve, rejection) => {
        binance.trades(currencyCode, (error, trades, symbol) => {
            if (error) {
                rejection(error);
                return;
            }
            resolve({
                symbol,
                trades
            });
        });
    });
}

function getBalance() {
    return new Promise((resolve, rejection) => {
        binance.balance((error, balances) => {
            if (error) {
                rejection(error);
                return;
            }
            resolve(balances);
        });
    });
}

function marketBuy(symbol, quantity) {
    return new Promise((resolve, rejection) => {
        binance.marketBuy(symbol, quantity, (error, response) => {
            if (error) {
                rejection(error.body);
                return;
            }
            resolve(response);
        });
    });
}

function marketSell(symbol, quantity) {
    return new Promise((resolve, rejection) => {
        binance.marketSell(symbol, quantity, (error, response) => {
            if (error) {
                rejection(error.body);
                return;
            }
            resolve(response);
        });
    });
}

function limitBuy(symbol, quantity, price) {
    return new Promise((resolve, rejection) => {
        binance.buy(symbol, quantity, price, { type: 'LIMIT' }, (error, response) => {
            if (error) {
                rejection(error.body);
                return;
            }
            resolve(response);
        });
    });
}

function limitSell(symbol, quantity, price) {
    return new Promise((resolve, rejection) => {
        binance.sell(symbol, quantity, price, { type: 'LIMIT' }, (error, response) => {
            if (error) {
                rejection(error.body);
                return;
            }
            resolve(response);
        });
    });
}

function cancelLimitOrder(symbol, orderId) {
    return new Promise((resolve, rejection) => {
        binance.cancel(symbol, orderId, (error, response) => {
            if (error) {
                rejection(error.body);
                return;
            }
            resolve(response);
        });
    });
}

function cancelLimitOrders(symbol) {
    return new Promise((resolve, rejection) => {
        binance.cancelOrders(symbol, (error, response) => {
            if (error) {
                rejection(error.body);
                return;
            }
            resolve(response);
        });
    });
}

function watchPrice(symbol, handler) {
    binance.websockets.trades([symbol], (trades) => {
        const {
            e: eventType,
            E: eventTime,
            s: symbol,
            p: price,
            q: quantity,
            m: maker,
            a: tradeId
        } = trades;

        handler(symbol, price);
    });
}

function fetchExchangeInfo() {
    return new Promise((resolve, rejection) => {
        binance.exchangeInfo(function(error, data) {
            if (error) {
                rejection(error.body);
                return;
            }
            resolve(data);
        });
    });
}