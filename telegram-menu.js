const balanceButton = {
    text: 'Get balances',
    callback_data: 'GET_BALANCES'
}

const currenciesInOrderButton = {
    text: 'Get prices of "in order" symbols',
    callback_data: 'GET_PRICES_IN_ORDER_CURRENCIES'
}

module.exports = [
    [balanceButton],
    [currenciesInOrderButton]
];