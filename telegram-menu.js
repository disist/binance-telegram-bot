const balanceButton = {
    text: 'Get balances',
    callback_data: 'GET_BALANCES'
}

const currentEarningsButton = {
    text: 'Get the current earnings',
    callback_data: 'GET_CURRENT_EARNINGS'
}

const currentDetailedEarningsButton = {
    text: 'Get detailed the current earnings',
    callback_data: 'GET_DETAILED_CURRENT_EARNINGS'
}

const getOrdersButton = {
    text: 'Get active orders',
    callback_data: 'GET_ACTIVE_ORDERS'
}

module.exports = [
    [balanceButton],
    [currentEarningsButton, currentDetailedEarningsButton],
    [getOrdersButton]
];