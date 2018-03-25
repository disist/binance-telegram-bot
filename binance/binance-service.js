const telegramService = require('../telegram/telegram-service');
const binance = require('./binance-api-wrapper');
const binancePriceWatcher = require('./binance-price-watcher');
const currencyHelper = require('./currency-helper');

module.exports = {
    GET_BALANCES: getBinanceBalances,
    GET_CURRENT_EARNINGS: getСurrentEarnings,
    GET_DETAILED_CURRENT_EARNINGS: (chatId) => getСurrentEarnings(chatId, true),
    GET_ACTIVE_ORDERS: getActiveOrders,
    GET_ACTIVE_VIRTUAL_ORDERS: getActiveVirtualOrders,
    BUY_SIGNAL: placeBuySignal,
    PLACE_ORDER_LIMIT: placeOrderLimit,
    PLACE_VIRTUAL_STOP_LOSS: placeVirtualStopLoss,
    DELETE_ORDER: deleteOrder,
    DELETE_VIRTUAL_ORDER: deleteVirtualOrder,
    GET_LATEST_PRICE: getLatestPrice
}

function getBinanceBalances(chatId) {
    return binance.getBalance()
        .then((balances) => {
            let result = `| Symbol | Available | On Order | \n`;
            result += '|-------|---------|---------| \n';

            Object.keys(balances).forEach((currencyCode) => {
                const currency = balances[currencyCode];

                if (+currency.available || +currency.onOrder) {
                    result += `| ${currencyCode} | ${Number(currency.available)} | ${Number(currency.onOrder)} |\n`;
                }
            });

            return telegramService.sendTelegramMessage(chatId, result);
        });
}

function getСurrentEarnings(chatId, detailed) {
    let inOrderCurrencies = new Set();
    let latestPrices;
    let openOrders;

    return binance.getOpenOrders()
        .then((orders) => {
            openOrders = orders.filter((order) => {
                if (order.side === 'SELL') {
                    inOrderCurrencies.add(order.symbol);
                    return true;
                }
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
            let result = detailed
                ? `| Symbol | PurchasePrice | CurrentPrice |    Δ    | \n`
                : '';

            inOrderCurrencies.forEach((currencyCode) => {
                if (latestPrices[currencyCode]) {
                    const currentPrice = Number(latestPrices[currencyCode]);

                    const tradeHistory = tradeHistories.find((history) => history.symbol === currencyCode);
                    const buyOrders = tradeHistory.trades.filter((order) => order.isBuyer);

                    // In case of older history orders by this symbol,
                    // we should find the last orders when the purchase was made
                    const inOrderQty = openOrders.reduce((prev, curr) => {
                        if (curr.symbol === currencyCode) {
                            return prev + Number(curr.origQty);
                        }
                        return prev;
                    }, 0);

                    let inOrderOtyByOrders = 0;
                    let properBuyOrders = [];
                    let index = buyOrders.length - 1;
                    while (inOrderOtyByOrders < inOrderQty) {
                        inOrderOtyByOrders += Number(buyOrders[index].qty);
                        properBuyOrders.push(buyOrders[index]);
                        index--;
                    }
                    //--

                    let purchasePrice;

                    if (properBuyOrders.length === 1) {
                        purchasePrice = Number(properBuyOrders[0].price);
                    }

                    if (properBuyOrders.length > 1) {
                        // In case of many buy orders we reduce purchasePrice by next formula 
                        // purchasePrice = ( (qty * price)1st + (qty * price)2nd ...) / all qty
                        let priceMultiplyQty = 0;
                        let allQty = 0;
                        for (let i = 0; i < properBuyOrders.length; i++) {
                            priceMultiplyQty += properBuyOrders[i].price * properBuyOrders[i].qty;
                            allQty += Number(properBuyOrders[i].qty);
                        }

                        purchasePrice = Number((priceMultiplyQty / allQty).toFixed(8));
                    }

                    const delta = (currentPrice - purchasePrice) / purchasePrice * 100;

                    result += detailed
                        ? `| ${currencyCode} | ${purchasePrice} | ${currentPrice} | ${delta.toFixed(2)}% |\n`
                        : `${currencyCode}: Δ: ${delta.toFixed(1)}%\n`;
                }
            });

            if (!result) {
                result = 'No open trades';
            }

            return telegramService.sendTelegramMessage(chatId, result);
        });
}

function getActiveOrders(chatId) {
    return binance.getOpenOrders()
        .then((openOrders) => {
            let result = `| Symbol | Type | Qty |  Price | \n`;
            result += '|-------|-----|----|------| \n \n';

            if (openOrders.length === 0) {
                return telegramService.sendTelegramMessage(chatId, `You don't have active orders`);
            }

            openOrders.forEach((order) => {
                const price = Number(order.price);
                const quantity = Number(order.origQty);

                result += `| ${order.symbol} | ${order.side} | ${quantity} | ${price} \n`;
                result += `/closeBinanceOrder${order.orderId}${order.symbol} \n \n`;
            });


            return telegramService.sendTelegramMessage(chatId, result);
        });
}

function getActiveVirtualOrders(chatId) {
    const orders = binancePriceWatcher.getActiveVirtualOrders();

    let result = `| Symbol |      Type      |     Price     | \n`;

    if (orders.length === 0) {
        return telegramService.sendTelegramMessage(chatId, `You don't have virtual orders`);
    }

    orders.forEach((order) => {
        result += `| ${order.symbol} | ${order.type} | ${order.price} | \n`;
        result += `/closeVirtualOrder${order.id} \n \n`;
    });

    return telegramService.sendTelegramMessage(chatId, result);
}

function placeOrderLimit(chatId, type, symbol, quantity, price) {
    const btcBasedSymbol = currencyHelper.getBTCBasedSymbol(symbol);

    const queryPromise = type.toLowerCase() === 'sell'
        ? binance.limitSell
        : binance.limitBuy

    return queryPromise(btcBasedSymbol, quantity, price)
        .then(() => telegramService.sendTelegramMessage(chatId, 'ok'));
}

function placeBuySignal(chatId) {
    const ONE_ORDER_BTC_QTY = 0.009;

    let signalSymbol;
    let signalSymbolWithBTC;

    let symbolQty;

    let symbolLatestPrice;

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
            signalSymbol = symbol.toUpperCase();
            signalSymbolWithBTC = currencyHelper.getBTCBasedSymbol(signalSymbol);

            return binance.getLatestPriceForSymbol(signalSymbolWithBTC);
        })
        .then((latestPrice) => {
            symbolLatestPrice = latestPrice;

            telegramService.sendTelegramMessage(chatId, `latest price: ${latestPrice}`);

            return _getTakeProfitLevels(chatId);
        })
        .then((levels) => {
            takeProfitLevels = levels;

            const estimatedSymbolQty = ajustQty(signalSymbolWithBTC, ONE_ORDER_BTC_QTY / symbolLatestPrice);
            console.log('>> estimatedSymbolQty', estimatedSymbolQty);

            return binance.marketBuy(signalSymbolWithBTC, estimatedSymbolQty);
        })
        .then(() => binance.getBalance())
        .then((balances) => {
            symbolQty = balances[signalSymbol].available;
            console.log('>> real symbolQty', symbolQty);
            let takeProfitOrders;

            // For 4 orders schema: 30% - 30% - 30% - 10%
            if (takeProfitLevels.length === 4) {
                takeProfitOrders = [
                    binance.limitSell(signalSymbolWithBTC, ajustQty(signalSymbolWithBTC, symbolQty * 0.3), takeProfitLevels[0]),
                    binance.limitSell(signalSymbolWithBTC, ajustQty(signalSymbolWithBTC, symbolQty * 0.3), takeProfitLevels[1]),
                    binance.limitSell(signalSymbolWithBTC, ajustQty(signalSymbolWithBTC, symbolQty * 0.3), takeProfitLevels[2]),
                    binance.limitSell(signalSymbolWithBTC, ajustQty(signalSymbolWithBTC, symbolQty * 0.1), takeProfitLevels[3])
                ];
            }

            // For 3 orders schema: 40% - 30% - 30%
            if (takeProfitLevels.length === 3) {
                takeProfitOrders = [
                    binance.limitSell(signalSymbolWithBTC, ajustQty(signalSymbolWithBTC, symbolQty * 0.4), takeProfitLevels[0]),
                    binance.limitSell(signalSymbolWithBTC, ajustQty(signalSymbolWithBTC, symbolQty * 0.3), takeProfitLevels[1]),
                    binance.limitSell(signalSymbolWithBTC, ajustQty(signalSymbolWithBTC, symbolQty * 0.3), takeProfitLevels[2])
                ];
            }

            // For 2 orders schema: 70% - 30%
            if (takeProfitLevels.length === 2) {
                takeProfitOrders = [
                    binance.limitSell(signalSymbolWithBTC, ajustQty(signalSymbolWithBTC, symbolQty * 0.7), takeProfitLevels[0]),
                    binance.limitSell(signalSymbolWithBTC, ajustQty(signalSymbolWithBTC, symbolQty * 0.3), takeProfitLevels[1])
                ];
            }

            return Promise.all(takeProfitOrders);
        })
        .then(() => telegramService.promptMessage(chatId, `Please specify Stop Loss`))
        .then((stopLossPrice) => binancePriceWatcher.placeVirtualStopLoss(chatId, signalSymbolWithBTC, symbolQty, stopLossPrice))
        .then(() => telegramService.sendTelegramMessage(chatId, 'ok'));
}

function placeVirtualStopLoss(chatId, symbol, targerQty, price) {
    return binancePriceWatcher.placeVirtualStopLoss(chatId, symbol, targerQty, price)
        .then(() => telegramService.sendTelegramMessage(chatId, 'ok'));
}

function deleteOrder(chatId, symbol, orderId) {
    return binance.cancelLimitOrder(symbol, orderId)
        .then(() => telegramService.sendTelegramMessage(chatId, 'ok'));
}

function deleteVirtualOrder(chatId, orderId) {
    return binancePriceWatcher.closeVirtualOrder(orderId)
        .then(() => telegramService.sendTelegramMessage(chatId, 'ok'));
}

function getLatestPrice(chatId, symbol) {
    const btcBasedSymbol = currencyHelper.getBTCBasedSymbol(symbol);

    return binance.getLatestPriceForSymbol(btcBasedSymbol)
        .then((latestPrice) => telegramService.sendTelegramMessage(chatId, `${btcBasedSymbol} - ${latestPrice}`));
}

function ajustQty(btcBasedSymbol, inputQty) {
    const exchangeInfo = binance.getExchangeInfo();
    const currentSymbolConfig = exchangeInfo.symbols.find((item) => item.symbol === btcBasedSymbol);
    const currentSymbolLotSize = currentSymbolConfig.filters.find((item) => item.filterType === 'LOT_SIZE');

    const result = binance.roundStep(inputQty, currentSymbolLotSize.stepSize);

    if (result < currentSymbolLotSize.minQty) {
        throw ('No enough money');
    }

    return result;
}

function _getTakeProfitLevels(chatId) {
    let takeProfitLevels = [];

    return askLevel(0);

    function askLevel(level) {
        level++;

        return telegramService.promptMessage(chatId, `Please specify ${level} level of Take Profit, "none" or "n" for end`)
            .then((result) => {
                if (isNaN(parseFloat(result))) {
                    return telegramService.sendTelegramMessage(chatId, `Incorrect price, let's try again`)
                        .then(() => askLevel(--level));
                }

                if (result !== 'none' && result !== 'n') {
                    takeProfitLevels.push(result);

                    return askLevel(level);
                }

                if (result === 'exit') {
                    return Promise.reject('exit');
                }

                return Promise.resolve(takeProfitLevels);
            });
    }
}
