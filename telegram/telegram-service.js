// Required for fix https://github.com/yagop/node-telegram-bot-api/issues/319.
require('bluebird');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TelegramBot = require('node-telegram-bot-api');

const telegramMenu = require('./telegram-menu');

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

let commandHandler;
let messageObservers = [];

module.exports = {
    subscribeForCommand,
    sendTelegramMessage,
    promptMessage
}

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    const inlineCommands = [
        `\n`,
        `/placeBinanceOrderLimit type symbol qty price`
    ];

    bot.sendMessage(chatId, 'Available commands:' + inlineCommands.join(`\n`), {
        reply_markup: {
            inline_keyboard: telegramMenu
        }
    });
});

bot.onText(/\/closeBinanceOrder(\d+)(\w+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const orderId = match[1];
    const symbol = match[2];

    console.log(`chatId ${chatId} orderId ${orderId} symbol ${symbol}`);
  
    commandHandler('DELETE_ORDER', chatId, symbol, orderId)
        .catch((rejection) => {
            console.log('>> rejection', rejection);

            return sendTelegramMessage(chatId, 'Something went wrong');
        });
});

bot.onText(/\/placeBinanceOrderLimit (.+) (.+) (.+) (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const type = match[1];
    const symbol = match[2];
    const qty = match[3];
    const price = match[4];

    if (!type) {
        sendTelegramMessage(chatId, 'type is not provided');
        return;
    }

    if (!symbol) {
        sendTelegramMessage(chatId, 'symbol is not provided');
        return;
    }

    if (!qty) {
        sendTelegramMessage(chatId, 'quantity is not provided');
        return;
    }

    if (!price) {
        sendTelegramMessage(chatId, 'price is not provided');
        return;
    }
  
    commandHandler('PLACE_ORDER_LIMIT', chatId, type, symbol, qty, price)
        .catch((rejection) => {
            console.log('>> rejection', rejection);

            return sendTelegramMessage(chatId, 'Something went wrong');
        });
});

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const command = query.data;

    if (!commandHandler) {
        throw ('>> telegram-service >> The commandHandler is not set');
    }

    commandHandler(command, chatId)
        .catch((rejection) => {
            console.log('>> rejection', rejection);

            return sendTelegramMessage(chatId, 'Something went wrong');
        })
        .then(() => bot.answerCallbackQuery(query.id));
});

bot.on('message', (message) => {

    if (!message.reply_to_message) {
        return;
    }

    messageObservers.forEach((observer, index) => {
        if (message.reply_to_message.message_id === observer.expectedMessageId) {
            observer.handler(message);
            messageObservers.splice(index, 1);
        }
    });
});

bot.on('polling_error', (error) => {
    console.log(`>> telegram-service >> polling_error >> ${error}`);
});

function subscribeForCommand(handler) {
    commandHandler = handler;
}

function promptMessage(chatId, labelMessage) {
    return bot.sendMessage(chatId, labelMessage, { reply_markup: { force_reply: true } })
        .then((result) => {
            const expectedMessageId = result.message_id;

            return observeReplayOnMessage(expectedMessageId);
        })
        .then((message) => message.text);
}

function observeReplayOnMessage(expectedMessageId) {
    return new Promise((resolve) => {
        const handler = (message) => resolve(message);

        messageObservers.push({
            expectedMessageId,
            handler
        });
    });
}

function sendTelegramMessage(chatId, message, options) {
    return bot.sendMessage(chatId, message, options);
}