// Required for fix https://github.com/yagop/node-telegram-bot-api/issues/319.
require('bluebird');

const binance = require('node-binance-api');
const TelegramBot = require('node-telegram-bot-api');

const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const BINANCE_API_SECRET = process.env.BINANCE_API_SECRET;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

binance.options({
    APIKEY: BINANCE_API_KEY,
    APISECRET: BINANCE_API_SECRET,
    useServerTime: true, // If you get timestamp errors, synchronize to server time at startup
    test: true // If you want to use sandbox mode where orders are simulated
});

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

const balanceButton = {
    text: 'Get balances',
    callback_data: 'GET_BALANCES'
}

const currenciesButton = {
    text: 'Get prices of having symbols',
    callback_data: 'GET_PRICES_HAVING_CURRENCIES'
}

const currenciesInOrderButton = {
    text: 'Get prices of "in order" symbols',
    callback_data: 'GET_PRICES_IN_ORDER_CURRENCIES'
}

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    bot.sendMessage(chatId, 'Available commands', {
        reply_markup: {
            inline_keyboard: [
                [balanceButton],
                [currenciesButton],
                [currenciesInOrderButton]
            ]
        }
    });
});

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;

    bot.answerCallbackQuery({
        callback_query_id: query.id,
        text: 'ok',
    });

    if (query.data === 'GET_BALANCES') {
        getBinanceBalances().then((result) => {
            bot.sendMessage(chatId, result);
        });
    }

    if (query.data === 'GET_PRICES_HAVING_CURRENCIES') {
        getPricesOfHavingCurrencies().then((result) => {
            bot.sendMessage(chatId, result);
        });
    }

    if (query.data === 'GET_PRICES_IN_ORDER_CURRENCIES') {
        getPricesOfInOrderCurrencies().then((result) => {
            bot.sendMessage(chatId, result);
        });
    }
});

bot.onText(/\/balance (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const secondWord = match[1]; // like NEOBTC
    const currency = (secondWord || '').toUpperCase();

    binance.prices(currency, (error, ticker) => {

        if (!ticker) {
            bot.sendMessage(chatId, `Hmmm seems like I don't know "${currency}", please write something like NEOBTC`);
            return;
        }

        if (ticker && ticker[currency]) {
            bot.sendMessage(chatId, ticker[currency]);
        }
    });
});

bot.on('polling_error', (error) => {
    console.log(`>> polling_error >> ${error}`);
});

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

function getPricesOfHavingCurrencies() {
    return new Promise((resolve) => {
        binance.balance((error, balances) => {
            let havingCurrencies = [];
            let result = '';

            Object.keys(balances).forEach((currencyCode) => {
                const currency = balances[currencyCode];

                if (+currency.available || +currency.onOrder) {
                    havingCurrencies.push(currencyCode);
                }
            });

            binance.prices((error, ticker) => {
                havingCurrencies.forEach((currencyCode) => {
                    const currencyCodeBaseOnBTC = `${currencyCode.toUpperCase()}BTC`;

                    if (ticker[currencyCodeBaseOnBTC]) {
                        result += `${currencyCodeBaseOnBTC.padEnd(9)}: Price: ${ticker[currencyCodeBaseOnBTC]}\n`;
                    }
                });

                resolve(result);
            });
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
                            result += `${currencyCode.padEnd(9)}: Price: ${ticker[currencyCode]}\n`;
                        }
                    });
    
                    resolve(result);
                });
            });

        });
    });
}