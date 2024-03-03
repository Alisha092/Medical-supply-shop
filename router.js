const ejs = require('ejs');
const Product = require('./models/product');
const db = require('./config/db');
const {
    parseCookies,
    handleAddToCart,
    handleDeleteFromCart,
    generateSessionId,
    getSessionId,
    handlePurchase,
    handleError,
    handleNotFound
} = require('./utilityFunctions');

// Handles rendering the products page with sorting functionality
async function handleProductsPage(req, res) {
    try {
        const method = req.method;

        if (method === 'GET') {
            // Parse the request URL to access query parameters
            const reqUrl = new URL(req.url, `http://${req.headers.host}`);
            const searchParams = reqUrl.searchParams;

            // Extract sort and order parameters
            const sortBy = searchParams.get('sortBy');
            const order = searchParams.get('order');

            let products;

            // Fetch products based on sorting parameters if present
            if (!sortBy && !order) {
                products = await Product.findAllCached();
            } else {
                products = await Product.sort(sortBy, order);
            }

            // Render the products page with fetched products data
            ejs.renderFile(__dirname + '/views/products.ejs', { products }, (err, result) => {
                if (err) {
                    handleError(req, res, 'Error loading product page. Please refresh.');
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(result);
            });
        } else {
            handleError(req, res, 'Page not found');
        }
    } catch (error) {
        handleError(req, res, error);
    }
}

// Handles rendering the cart page with items from the user's session
async function handleCartPage(req, res) {
    try {
        const method = req.method;
        const sessionId = getSessionId(req, res);

        if (method === 'GET') {
            // SQL query to fetch cart items for the current session
            let sql = `SELECT ci.quantity, p.product_id, p.name, p.price, p.stock_quantity, p.image_url, p.discount_amount, (p.price - (p.price * COALESCE(p.discount_amount, 0) / 100)) AS final_price FROM cart_items ci JOIN products p ON ci.product_id = p.product_id WHERE ci.session_id = ?`;

            const [cartItems] = await db.execute(sql, [sessionId]);
            const updatedCartItems = cartItems.map(item => ({
                ...item,
                total_price: item.final_price * item.quantity,
            }));

            // Render the cart page with fetched cart items
            ejs.renderFile(__dirname + '/views/cart.ejs', { cartItems: updatedCartItems }, (err, result) => {
                if (err) {
                    handleError(req, res, 'Error loading cart page. Please try again.');
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(result);
            });
        } else if (method === 'POST') {
            handleAddToCart(req, res); // Add item to cart
        } else {
            handleError(req, res); // Handle unsupported methods
        }
    } catch (error) {
        handleError(req, res, error);
    }
}

// Handles rendering the home page
function handleHomePage(req, res) {
    try {
        const method = req.method;

        if (method === 'GET') {
            ejs.renderFile(__dirname + '/views/homePage.ejs', {}, (err, result) => {
                if (err) {
                    handleError(req, res, 'Error loading home page. Please refresh.');
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(result);
            });
        } else {
            handleError(req, res); // Handle unsupported methods
        }
    } catch (error) {
        handleError(req, res, error);
    }
}

// Main routing function to handle different routes based on the request URL
function route(req, res) {
    // Parse cookies from the request
    const cookies = parseCookies(req);
    // If sessionId cookie is not present, generate a new sessionId and set it as a cookie
    if (!cookies.sessionId) {
        const sessionId = generateSessionId();
        res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; HttpOnly`);
    }

    // Determine the request's pathname
    const reqUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = reqUrl.pathname;

    // Route the request to the appropriate handler based on the pathname
    switch (pathname) {
        case '/':
            handleHomePage(req, res);
            break;
        case '/products':
            handleProductsPage(req, res);
            break;
        case '/cart':
            handleCartPage(req, res);
            break;
        case '/delete-from-cart':
            handleDeleteFromCart(req, res);
            break;
        case '/purchase':
            handlePurchase(req, res);
            break;
        default:
            handleNotFound(req, res); // Handle undefined routes
            break;
    }
}

// Export the route function for use in other files
module.exports = { route };
