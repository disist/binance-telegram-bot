// Required for fix https://github.com/yagop/node-telegram-bot-api/issues/319.
require('bluebird');

const TelegramBot = require('node-telegram-bot-api');

const telegramMenu = require('./telegram-menu');
const binanceService = require('./binance-service');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    bot.sendMessage(chatId, 'Available commands', {
        reply_markup: {
            inline_keyboard: telegramMenu
        }
    });
});

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;

    let queryPromise;

    if (!binanceService[query.data]) {
        console.log(`>> the command "${query.data} is not exists"`);
    }

    queryPromise = binanceService[query.data];

    queryPromise()
        .then((result) => bot.sendMessage(chatId, result))
        .then(() => bot.answerCallbackQuery(query.id));
});

bot.on('polling_error', (error) => {
    console.log(`>> polling_error >> ${error}`);
});