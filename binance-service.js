const binance = require('node-binance-api');
const telegramService = require('./telegram-service');

const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const BINANCE_API_SECRET = process.env.BINANCE_API_SECRET;

binance.options({
    APIKEY: BINANCE_API_KEY,
    APISECRET: BINANCE_API_SECRET,
    useServerTime: true,
    test: false // If you want to use sandbox mode where orders are simulated
});

module.exports = {
    GET_BALANCES: getBinanceBalances,
    GET_CURRENT_EARNINGS: getСurrentEarnings,
    GET_DETAILED_CURRENT_EARNINGS: getСurrentEarnings.bind(this, null, true),
    GET_ACTIVE_ORDERS: getActiveOrders,
    BUY_SIGNAL: placeBuySignal
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

function getСurrentEarnings(chatId, detailed) {
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
                    const buyOrders = tradeHistory.trades.filter((order) => order.isBuyer);

                    let purchasePrice;

                    if (buyOrders.length === 1) {
                        purchasePrice = Number(buyOrders[0].price);
                    }

                    if (buyOrders.length > 1) {
                        // In case of may buy orders we reduce purchasePrice by next formula 
                        // purchasePrice = ( (qty * price)1st + (qty * price)2nd ...) / all qty

                        let priceMultiplyQty = 0;
                        let allQty = 0;
                        for (let i = 0; i < buyOrders.length; i++) {
                            priceMultiplyQty += buyOrders[i].price * buyOrders[i].qty;
                            allQty += Number(buyOrders[i].qty);
                        }

                        purchasePrice = Number((priceMultiplyQty / allQty).toFixed(8));
                    }

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

function placeBuySignal(chatId) {
    const ONE_ORDER_BTC_QTY = 0.009;

    let signalSymbol;
    let signalSymbolWithBTC;

    let takeProfitLevels = [];

    return _getBalance()
        .then((balances) => {
            // Return available BTC balance
            return Number(balances.BTC.available);
        })
        .then((availableBtc) => {
            if (availableBtc < ONE_ORDER_BTC_QTY) {
                return Promise.reject('Is not enough BTC');
            }
            return telegramService.promptMessage(chatId, 'Please specify symbol');
        })
        .then((symbol) => {
            symbol = symbol.toUpperCase();
            // Be sure that symbol ends on BTC
            signalSymbol = symbol.replace('BTC', '');
            signalSymbolWithBTC = signalSymbol + 'BTC';

            return _getTakeProfitLevels(chatId);
        })
        .then((levels) => {
            takeProfitLevels = levels;

            return _getLatestPriceForSymbol(signalSymbolWithBTC);
        })
        .then((latestPrice) => {
            const estimatedSymbolQty = _normalizeQty(ONE_ORDER_BTC_QTY / latestPrice);
            console.log('>> estimatedSymbolQty', estimatedSymbolQty);

            return _marketBuy(signalSymbolWithBTC, estimatedSymbolQty);
        })
        .then(() => _getBalance())
        .then((balances) => {
            const symbolQty = balances[signalSymbol].available;
            console.log('>> real symbolQty', symbolQty);
            let takeProfitOrders;

            // For 4 orders schema: 30% - 30% - 30% - 10%
            if (takeProfitLevels.length === 4) {
                takeProfitOrders = [
                    _limitSell(signalSymbolWithBTC, _normalizeQty(symbolQty * 0.3), takeProfitLevels[0]),
                    _limitSell(signalSymbolWithBTC, _normalizeQty(symbolQty * 0.3), takeProfitLevels[1]),
                    _limitSell(signalSymbolWithBTC, _normalizeQty(symbolQty * 0.3), takeProfitLevels[2]),
                    _limitSell(signalSymbolWithBTC, _normalizeQty(symbolQty * 0.1), takeProfitLevels[3])
                ];
            }

            // For 3 orders schema: 40% - 30% - 30%
            if (takeProfitLevels.length === 3) {
                takeProfitOrders = [
                    _limitSell(signalSymbolWithBTC, _normalizeQty(symbolQty * 0.4), takeProfitLevels[0]),
                    _limitSell(signalSymbolWithBTC, _normalizeQty(symbolQty * 0.3), takeProfitLevels[1]),
                    _limitSell(signalSymbolWithBTC, _normalizeQty(symbolQty * 0.3), takeProfitLevels[2])
                ];
            }

            // For 2 orders schema: 60% - 40%
            if (takeProfitLevels.length === 2) {
                takeProfitOrders = [
                    _limitSell(signalSymbolWithBTC, _normalizeQty(symbolQty * 0.6), takeProfitLevels[0]),
                    _limitSell(signalSymbolWithBTC, _normalizeQty(symbolQty * 0.4), takeProfitLevels[1])
                ];
            }

            return Promise.all(takeProfitOrders);
        })
        .then(() => 'ok');
}

function _getTakeProfitLevels(chatId) {
    let takeProfitLevels = [];

    return askLevel(0);

    function askLevel(level) {
        level++;

        return telegramService.promptMessage(chatId, `Please specify ${level} level of Take Profit, "none" or "n" for end`)
            .then((result) => {
                if (result !== 'none' && result !== 'n') {
                    takeProfitLevels.push(result);

                    return askLevel(level);
                }

                return Promise.resolve(takeProfitLevels);
            });
    }
}

function _normalizeQty(quantity) {
    quantity = Number(quantity);

    if (quantity > 100) {
        quantity = Number(quantity.toFixed(0));
    }

    if (quantity > 10) {
        quantity = Number(quantity.toFixed(2));
    }

    if (quantity > 1) {
        quantity = Number(quantity.toFixed(3));
    }

    quantity = Number(quantity.toFixed(5));

    return quantity;
}

// Binance API promise wrappers

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

function _getLatestPriceForSymbol(symbol) {
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

function _marketBuy(symbol, quantity) {
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

function _limitSell(symbol, quantity, price) {
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