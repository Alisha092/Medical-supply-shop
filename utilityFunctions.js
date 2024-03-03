const Cart = require('./models/cart');
const Purchase = require('./models/purchase');
const ejs = require('ejs');

// Generates a unique session ID using the current timestamp.
function generateSessionId() {
    return `sid_${Date.now()}`;
}

// Parses cookies from the request header and returns an object with cookie names and values.
function parseCookies(request) {
    const list = {};
    const cookieHeader = request.headers.cookie;

    if (cookieHeader) {
        cookieHeader.split(';').forEach(function (cookie) {
            const parts = cookie.split('=');
            list[parts.shift().trim()] = decodeURI(parts.join('='));
        });
    }

    return list;
}

// Retrieves the session ID from the request cookies.
function getSessionId(req) {
    const cookies = parseCookies(req);
    return cookies.sessionId;
}

// Handles adding an item to the cart.
async function handleAddToCart(req, res) {
    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString(); // Accumulates data chunks.
        });
        req.on('end', async () => {
            try {
                const parsedBody = new URLSearchParams(body); // Parses the request body.
                const productId = parsedBody.get('product_id');
                const sessionId = getSessionId(req);

                if (!sessionId) {
                    let error = 'Session ID is missing';
                    handleError(req, res, error);
                }

                await Cart.addToCart(productId, sessionId); // Adds the product to the cart.

                if (!res.headersSent) {
                    res.writeHead(302, { Location: '/cart' }); // Redirects to the cart page.
                    res.end();
                }
            } catch (error) {
                if (!res.headersSent) {
                    handleError(req, res, 'An error occurred while adding to the cart.');
                }
                return;
            }
        });
    } else {
        if (!res.headersSent) {
            handleError(req, res, 'Not Found 404'); // Handles non-POST requests.
            return;
        }
    }
}

// Handles removing an item from the cart.
async function handleDeleteFromCart(req, res) {
    let body = '';

    req.on('data', chunk => {
        body += chunk.toString(); // Accumulates data chunks.
    });

    req.on('end', async () => {
        const parsedBody = new URLSearchParams(body); // Parses the request body.
        const productId = parsedBody.get('product_id');
        const sessionId = getSessionId(req);

        try {
            await Cart.deleteFromCart(productId, sessionId); // Deletes the product from the cart.

            if (!res.headersSent) {
                res.writeHead(302, { Location: '/cart' }); // Redirects to the cart page.
                res.end();
            }
        } catch (error) {
            if (!res.headersSent) {
                handleError(req, res, 'An error occurred while deleting from the cart.');
                return;
            }
        }
    });
}

// Handles the purchase process.
async function handlePurchase(req, res) {
    if (req.method !== 'POST') {
        handleError(req, res, 'Page not found'); // Handles non-POST requests.
        return;
    }

    const sessionId = getSessionId(req);
    if (!sessionId) {
        if (!res.headersSent) {
            handleError(req, res, 'Session ID is required for this action.');
        }
        return;
    }

    let body = '';
    req.on('data', chunk => {
        body += chunk.toString(); // Accumulates data chunks.
    });

    req.on('end', async () => {
        try {
            const parsedBody = new URLSearchParams(body); // Parses the request body.
            const userPhoneNumb = parsedBody.get('phoneNumber');

            if (!userPhoneNumb || userPhoneNumb.length < 11) {
                handleError(req, res, 'A valid phone number is required for purchase.');
                return;
            }

            // Retrieves product IDs from the cart.
            const productIds = await Cart.getCartItems(sessionId).then(items => items.map(item => item.product_id));

            // Checks if any product was previously bought on offer by the user.
            const previouslyBoughtOnOffer = await Purchase.checkIfBoughtOnOffer(userPhoneNumb, productIds);

            if (previouslyBoughtOnOffer) {
                let error = 'You cannot buy this product again as it was previously purchased on offer.';
                handleError(req, res, error);
                return;
            }

            // Calculates the total price of the cart.
            const totalPrice = await Cart.calculateTotalPrice(sessionId);
            if (totalPrice === 0) {
                if (!res.headersSent) {
                    let error = 'Your cart is empty or an error occurred.';
                    handleError(req, res, error);
                }
                return;
            }

            // Prepares and saves the purchase.
            const cartItems = await Cart.getCartItems(sessionId,);
            const purchase = new Purchase(userPhoneNumb, cartItems.map(item => item.product_id), totalPrice);
            await purchase.save();

            // Clears the cart after purchase.
            await Cart.clearCart(sessionId);

            if (!res.headersSent) {
                // Renders the purchase confirmation page.
                ejs.renderFile(__dirname + '/views/purchase.ejs', { message: 'Thank you for your purchase' }, (err, result) => {
                    if (err) {
                        handleError(req, res, 'Error rendering purchase confirmation.');
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(result);
                });
            }
        } catch (error) {
            console.log(error);
            handleError(req, res, 'An error occurred during the purchase process.');
        }
    });
}


// Handles errors and renders the error page.
function handleError(req, res, err) {
    const error = err || 'An error occurred';

    ejs.renderFile(__dirname + '/views/error.ejs', { error }, async (err, result) => {
        if (err) {
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end('An error occurred while trying to render the error page.');
            }
            return;
        }
        if (!res.headersSent) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(result);
        } else {
            console.log("Response already sent, cannot send another.");
        }
    });
}

function handleNotFound(req, res) {
    ejs.renderFile(__dirname + '/views/notFound.ejs', {}, async (err, result) => {
        if (err) {
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end('An error occurred while trying to render the Not found page.');
            }
            return;
        }
        if (!res.headersSent) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(result);
        } else {
            console.log("Response already sent, cannot send another.");
        }
    });
}

module.exports = {
    parseCookies,
    handleAddToCart,
    handleDeleteFromCart,
    generateSessionId,
    getSessionId,
    handlePurchase,
    handleError,
    handleNotFound
}
