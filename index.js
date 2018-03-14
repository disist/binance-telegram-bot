const telegramService = require('./telegram/telegram-service');
const binanceService = require('./binance/binance-service');

require('./server');

telegramService.subscribeForCommand((commandName, ...args) => {
    
    if (!binanceService[commandName]) {
        throw(`>> the command "${commandName}" is not exists`);
    }

    const queryPromise = binanceService[commandName];

    return queryPromise(...args);
});