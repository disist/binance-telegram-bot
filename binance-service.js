const binance = require('node-binance-api');

const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const BINANCE_API_SECRET = process.env.BINANCE_API_SECRET;

binance.options({
    APIKEY: BINANCE_API_KEY,
    APISECRET: BINANCE_API_SECRET,
    useServerTime: true, // If you get timestamp errors, synchronize to server time at startup
    test: true // If you want to use sandbox mode where orders are simulated
});

module.exports = {
    GET_BALANCES: getBinanceBalances,
    GET_CURRENT_EARNINGS: getСurrentEarnings,
    GET_DETAILED_CURRENT_EARNINGS: getСurrentEarnings.bind(this, true),
    GET_ACTIVE_ORDERS: getActiveOrders
}

function getBinanceBalances() {
    return _getBalance()
        .then((balances) => {
            let result = '';

            Object.keys(balances).forEach((currencyCode) => {
                const currency = balances[currencyCode];

                if (+currency.available || +currency.onOrder) {
                    result += `${currencyCode}: Av.: ${Number(currency.available)} OnOr.: ${Number(currency.onOrder)}\n`;
                }
            });

            return result;
        });
}

function getСurrentEarnings(detailed) {
    let inOrderCurrencies = new Set();
    let latestPrices;

    return _getOpenOrders()
        .then((openOrders) => {
            openOrders.forEach((currency) => {
                inOrderCurrencies.add(currency.symbol);
            });

            return _getLatestPrices();
        })
        .then((ticker) => {
            latestPrices = ticker;

            const tradeHistoriesPromises = Array.from(inOrderCurrencies).map((currencyCode) => {
                return _getTradeHistoryBySymbol(currencyCode);
            });

            return Promise.all(tradeHistoriesPromises);
        })
        .then((tradeHistories) => {
            let result = '';

            inOrderCurrencies.forEach((currencyCode) => {
                if (latestPrices[currencyCode]) {
                    const currentPrice = Number(latestPrices[currencyCode]);

                    const tradeHistory = tradeHistories.find((history) => history.symbol === currencyCode);
                    const purchasePrice = Number(tradeHistory.trades.pop().price);

                    const delta = (currentPrice - purchasePrice) / purchasePrice * 100;

                    result += detailed
                        ? `${currencyCode}: PurchasePrice: ${purchasePrice}: CurrentPrice: ${currentPrice}: Δ: ${delta.toFixed(2)}%\n`
                        : `${currencyCode}: Δ: ${delta.toFixed(1)}%\n`;
                }
            });

            return result;
        });
}

function getActiveOrders() {
    return _getOpenOrders()
        .then((openOrders) => {
            let result = '';

            openOrders.forEach((order) => {
                const price = Number(order.price);
                const quantity = Number(order.origQty);

                result += `${order.symbol} ${order.side} Qty: ${quantity} Price: ${price}\n`;
            });

            return result;
        });
}

function _getOpenOrders() {
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

function _getLatestPrices() {
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

function _getTradeHistoryBySymbol(currencyCode) {
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

function _getBalance() {
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