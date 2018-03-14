const telegramService = require('../telegram/telegram-service');
const binance = require('./binance-api-wrapper');

module.exports = {
    GET_BALANCES: getBinanceBalances,
    GET_CURRENT_EARNINGS: getСurrentEarnings,
    GET_DETAILED_CURRENT_EARNINGS: (chatId) => getСurrentEarnings(chatId, true),
    GET_ACTIVE_ORDERS: getActiveOrders,
    BUY_SIGNAL: placeBuySignal,
    PLACE_ORDER_LIMIT: placeOrderLimit,
    DELETE_ORDER: deleteOrder,
}

function getBinanceBalances(chatId) {
    return binance.getBalance()
        .then((balances) => {
            let result = '';

            Object.keys(balances).forEach((currencyCode) => {
                const currency = balances[currencyCode];

                if (+currency.available || +currency.onOrder) {
                    result += `${currencyCode}: Av.: ${Number(currency.available)} OnOr.: ${Number(currency.onOrder)}\n`;
                }
            });

            return telegramService.sendTelegramMessage(chatId, result);
        });
}

function getСurrentEarnings(chatId, detailed) {
    let inOrderCurrencies = new Set();
    let latestPrices;

    return binance.getOpenOrders()
        .then((openOrders) => {
            openOrders.forEach((currency) => {
                inOrderCurrencies.add(currency.symbol);
            });

            return binance.getLatestPrices();
        })
        .then((ticker) => {
            latestPrices = ticker;

            const tradeHistoriesPromises = Array.from(inOrderCurrencies).map((currencyCode) => {
                return binance.getTradeHistoryBySymbol(currencyCode);
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

            return telegramService.sendTelegramMessage(chatId, result);
        });
}

function getActiveOrders(chatId) {
    return binance.getOpenOrders()
        .then((openOrders) => {
            let result = '';

            openOrders.forEach((order) => {
                const price = Number(order.price);
                const quantity = Number(order.origQty);

                result += `${order.symbol} ${order.side} Qty: ${quantity} Price: ${price} /closeBinanceOrder${order.orderId}${order.symbol} \n \n`;
            });


            return telegramService.sendTelegramMessage(chatId, result);
        });
}

function placeOrderLimit(chatId, type, symbol, quantity, price) {
    symbol = symbol.toUpperCase();
    // Be sure that symbol ends on BTC
    symbol = symbol.replace('BTC', '');
    symbol += 'BTC';

    queryPromise = type.toLowerCase() === 'sell'
        ? binance.limitSell
        : binance.limitBuy

    return queryPromise(symbol, quantity, price)
        .then(() => telegramService.sendTelegramMessage(chatId, 'ok'));
}

function placeBuySignal(chatId) {
    const ONE_ORDER_BTC_QTY = 0.009;

    let signalSymbol;
    let signalSymbolWithBTC;

    let takeProfitLevels = [];

    return binance.getBalance()
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

            return binance.getTakeProfitLevels(chatId);
        })
        .then((levels) => {
            takeProfitLevels = levels;

            return binance.getLatestPriceForSymbol(signalSymbolWithBTC);
        })
        .then((latestPrice) => {
            const estimatedSymbolQty = _normalizeQty(ONE_ORDER_BTC_QTY / latestPrice);
            console.log('>> estimatedSymbolQty', estimatedSymbolQty);

            return binance.marketBuy(signalSymbolWithBTC, estimatedSymbolQty);
        })
        .then(() => binance.getBalance())
        .then((balances) => {
            const symbolQty = balances[signalSymbol].available;
            console.log('>> real symbolQty', symbolQty);
            let takeProfitOrders;

            // For 4 orders schema: 30% - 30% - 30% - 10%
            if (takeProfitLevels.length === 4) {
                takeProfitOrders = [
                    binance.limitSell(signalSymbolWithBTC, _normalizeQty(symbolQty * 0.3), takeProfitLevels[0]),
                    binance.limitSell(signalSymbolWithBTC, _normalizeQty(symbolQty * 0.3), takeProfitLevels[1]),
                    binance.limitSell(signalSymbolWithBTC, _normalizeQty(symbolQty * 0.3), takeProfitLevels[2]),
                    binance.limitSell(signalSymbolWithBTC, _normalizeQty(symbolQty * 0.1), takeProfitLevels[3])
                ];
            }

            // For 3 orders schema: 40% - 30% - 30%
            if (takeProfitLevels.length === 3) {
                takeProfitOrders = [
                    binance.limitSell(signalSymbolWithBTC, _normalizeQty(symbolQty * 0.4), takeProfitLevels[0]),
                    binance.limitSell(signalSymbolWithBTC, _normalizeQty(symbolQty * 0.3), takeProfitLevels[1]),
                    binance.limitSell(signalSymbolWithBTC, _normalizeQty(symbolQty * 0.3), takeProfitLevels[2])
                ];
            }

            // For 2 orders schema: 60% - 40%
            if (takeProfitLevels.length === 2) {
                takeProfitOrders = [
                    binance.limitSell(signalSymbolWithBTC, _normalizeQty(symbolQty * 0.6), takeProfitLevels[0]),
                    binance.limitSell(signalSymbolWithBTC, _normalizeQty(symbolQty * 0.4), takeProfitLevels[1])
                ];
            }

            return Promise.all(takeProfitOrders);
        });
}

function deleteOrder(chatId, symbol, orderId) {
    return binance.cancelLimitOrder(symbol, orderId)
        .then(() => telegramService.sendTelegramMessage(chatId, 'ok'));
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