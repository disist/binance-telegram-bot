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
    GET_PRICES_IN_ORDER_CURRENCIES: getPricesOfInOrderCurrencies,
    GET_ACTIVE_ORDERS: getActiveOrders
}

function getBinanceBalances() {
    return new Promise((resolve) => {
        binance.balance((error, balances) => {
            let result = '';

            Object.keys(balances).forEach((currencyCode) => {
                const currency = balances[currencyCode];

                if (+currency.available || +currency.onOrder) {
                    result += `${currencyCode}: Av.: ${currency.available} OnOr.: ${currency.onOrder}\n`;
                }
            });

            resolve(result);
        });
    });
}

function getPricesOfInOrderCurrencies() {
    return new Promise((resolve) => {
        binance.balance((error, balances) => {
            let inOrderCurrencies = new Set();
            let result = '';

            binance.openOrders(false, (error, openOrders) => {
                openOrders.forEach((currency) => {
                    inOrderCurrencies.add(currency.symbol);
                });

                binance.prices((error, ticker) => {
                    inOrderCurrencies.forEach((currencyCode) => {
                        if (ticker[currencyCode]) {
                            const price = Number(ticker[currencyCode]);

                            result += `${currencyCode}: Price: ${price}\n`;
                        }
                    });

                    resolve(result);
                });
            });

        });
    });
}

function getActiveOrders() {
    return new Promise((resolve) => {
        let result = '';

        binance.openOrders(false, (error, openOrders) => {
            openOrders.forEach((order) => {
                const price = Number(order.price);
                const quantity = Number(order.origQty);

                result += `${order.symbol} ${order.side} Qty: ${quantity} Price: ${price}\n`;
            })

            resolve(result);
        });
    });
}