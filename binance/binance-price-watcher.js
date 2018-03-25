const binance = require('./binance-api-wrapper');
const storage = require('../storage/storage-service');
const currencyHelper = require('./currency-helper');
const telegramService = require('../telegram/telegram-service');

const ACTIVE_VIRTUAL_ORDERS_KEY = 'ACTIVE_VIRTUAL_ORDERS';

module.exports = {
    getActiveVirtualOrders,
    placeVirtualStopLoss,
    closeVirtualOrder
}

let activeVirtualOrders = [];

init();

function init() {
    storage.getObject(ACTIVE_VIRTUAL_ORDERS_KEY)
        .then((value) => {
            if (!Array.isArray(value)) {
                return;
            }

            value.forEach((order) => {
                switch (order.type) {
                    case 'STOP_LOSS': {
                        placeVirtualStopLoss(order.telegramChatId, order.symbol, order.quantity, order.price);
                        break;
                    }
                    default:
                        break;
                }
            });
        });
}

function getActiveVirtualOrders() {
    return activeVirtualOrders;
}

function placeVirtualStopLoss(chatId, symbol, targerQty, price) {
    const btcBasedSymbol = currencyHelper.getBTCBasedSymbol(symbol);

    _whenPriceLessOrEqual(btcBasedSymbol, price, targerQty, chatId, 'STOP_LOSS')
        .then(() => binance.cancelLimitOrders(btcBasedSymbol))
        .then(() => binance.getBalance())
        .then((balances) => {
            const balanceSymbol = btcBasedSymbol.replace('BTC', '');
            const availableQty = balances[balanceSymbol].available;

            // In a case when available qty greater than target qty we will use target qty
            const qty = Number(availableQty) > Number(targerQty)
                ? targerQty
                : availableQty;

            const adjustedQty = ajustQty(btcBasedSymbol, qty);

            return binance.marketSell(btcBasedSymbol, adjustedQty);
        })
        .then(() => telegramService.sendTelegramMessage(chatId, `${btcBasedSymbol} is closed by stop loss at ${price}`));

    return Promise.resolve(null);
}

function closeVirtualOrder(orderId) {
    binance.unsubscribeOnPriceChange(orderId);
    activeVirtualOrders = activeVirtualOrders.filter((order) => order.id !== Number(orderId));

    storage.setObject(ACTIVE_VIRTUAL_ORDERS_KEY, activeVirtualOrders);

    return Promise.resolve(null);
}

function _whenPriceLessOrEqual(symbol, levelPrice, quantity, telegramChatId, type) {
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
            type,
            price: levelPrice,
            quantity,
            telegramChatId
        });

        storage.setObject(ACTIVE_VIRTUAL_ORDERS_KEY, activeVirtualOrders);
    });
}

// TODO: 
function _whenPriceGreaterOrEqual(symbol, levelPrice, quantity, telegramChatId, type) {
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
            type,
            price: levelPrice,
            quantity,
            telegramChatId
        });

        storage.setObject(ACTIVE_VIRTUAL_ORDERS_KEY, activeVirtualOrders);
    });
}

// function oneMinuteDelay() {
//     return new Promise((resolve, rejection) => {
//         setTimeout(() => resolve(), 60000);
//     });
// }