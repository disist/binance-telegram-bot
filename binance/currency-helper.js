module.exports = {
    normalizeQty,
    getBTCBasedSymbol
}

// Deprecated
function normalizeQty(quantity) {
    quantity = Number(quantity);

    if (quantity > 100) {
        quantity = Number(quantity.toFixed(0));
    }

    if (quantity > 10) {
        quantity = Number(quantity.toFixed(2));
    }

    if (quantity > 1) {
        quantity = Number(quantity.toFixed(3));
    }

    quantity = Number(quantity.toFixed(5));

    return quantity;
}

function getBTCBasedSymbol(symbol) {
    symbol = symbol.toUpperCase();
    // Be sure that symbol ends on BTC
    symbol = symbol.replace('BTC', '');
    symbol += 'BTC';

    return symbol;
}