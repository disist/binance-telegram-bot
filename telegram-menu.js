const balanceButton = {
    text: 'Get balances',
    callback_data: 'GET_BALANCES'
}

const currenciesInOrderButton = {
    text: 'Get prices of "in order" symbols',
    callback_data: 'GET_PRICES_IN_ORDER_CURRENCIES'
}

const getOrdersButton = {
    text: 'Get active orders',
    callback_data: 'GET_ACTIVE_ORDERS'
}

module.exports = [
    [balanceButton],
    [currenciesInOrderButton],
    [getOrdersButton]
];