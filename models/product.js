const db = require('../config/db');
const { setAsync, getAsync } = require('../config/redis')


class Product {
    // Constructor to initialize a new Product instance with properties
    constructor(name, price, stock_quantity, image_url) {
        this.name = name;
        this.price = price;
        this.stock_quantity = stock_quantity;
        // Use a default image if none is provided
        this.image_url = image_url || '/assets/default';
    }

    // Saves the product instance to the database
    async save() {
        const sql = `
        INSERT INTO products(name, price, stock_quantity, image_url)
        VALUES (?, ?, ?, ?);
        `;

        // Execute the SQL query to insert the product into the database
        const [newProduct, _] = await db.execute(sql, [this.name, this.price, this.stock_quantity, this.image_url]);
        return newProduct;
    }

    // Static method to retrieve all products from the database
    static async findAll() {
        const sql = `SELECT * FROM products;`;
        const [products, _] = await db.execute(sql);
        return products;
    }

    // Static method to sort products based on a specified field and order
    static async sort(sortBy, order) {
        // Define allowed sort fields and orders to prevent SQL injection
        const allowedSortBy = ['price', 'product_id', 'discount_amount'];
        const allowedOrder = ['ASC', 'DESC'];

        // Validate sortBy and order parameters, defaulting to safe values if necessary
        sortBy = allowedSortBy.includes(sortBy) ? sortBy : 'product_id';
        order = allowedOrder.includes(order) ? order : 'ASC';

        // Dynamically build the SQL query based on validated sortBy and order
        let sql;
        if (sortBy === 'discount_amount') {
            // If sorting by discount_amount, calculate the discounted price for each product
            sql = `SELECT *, (price - (price * (discount_amount / 100))) AS discounted_price FROM products ORDER BY ${sortBy} ${order};`;
        } else {
            // For other sorts, use the straightforward ORDER BY clause
            sql = `SELECT * FROM products ORDER BY ${sortBy} ${order};`;
        }

        try {
            // Execute the sorting query and return the sorted products
            const [products, _] = await db.execute(sql);
            return products;
        } catch (error) {
            console.error('Error sorting products:', error);
            throw error; // Propagate the error
        }
    }

    static async updateStock(productId, quantity) {
        try {
            const sql = `
                UPDATE products
                SET stock_quantity = stock_quantity - ?
                WHERE product_id = ?;
            `;

            await db.execute(sql, [quantity, productId]);
            console.log(`Stock updated for product ID ${productId}`);
        } catch (error) {
            console.error('Error updating stock:', error);
            throw error;
        }
    }

    static async findAllCached() {
        const cacheKey = 'allProducts';
        try {
            // Try fetching the data from Redis cache
            const cachedProducts = await getAsync(cacheKey);
            if (cachedProducts) {
                return JSON.parse(cachedProducts);
            } else {
                // If not in cache, fetch from the database
                const products = await Product.findAll();
                // Store the fetched data in Redis cache, set to expire after 1 hour

                await setAsync(cacheKey, JSON.stringify(products));

                await client.expire(cacheKey, 3600);

                return products;
            }
        } catch (error) {
            console.error('Failed to fetch products:', error);
            throw error;
        }
    }


}

module.exports = Product;
