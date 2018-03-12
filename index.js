const telegramService = require('./telegram-service');
const binanceService = require('./binance-service');

require('./server');

telegramService.subscribeForCommand((commandName, chatId) => {

    if (!binanceService[commandName]) {
        throw(`>> the command "${query.data} is not exists"`);
    }

    const queryPromise = binanceService[commandName];

    return queryPromise(chatId);
});