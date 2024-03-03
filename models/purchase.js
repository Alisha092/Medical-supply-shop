const db = require('../config/db');
const Product = require('./product');


class Purchase {
    // Constructor initializes a new Purchase instance with user's phone number, items purchased, and total price
    constructor(userPhoneNumb, items, totalPrice) {
        this.userPhoneNumb = userPhoneNumb;
        // items is expected to be an array of product IDs. Convert array to a comma-separated string for storage
        this.items = items.join(',');
        this.totalPrice = totalPrice;
    }

    // Save the purchase to the database
    async save() {
        // Generate the current date in YYYY-MM-DD format
        const date = new Date();
        const y = date.getFullYear();
        const m = date.getMonth() + 1;
        const d = date.getDate();
        const formattedMonth = m < 10 ? `0${m}` : m;
        const formattedDay = d < 10 ? `0${d}` : d;
        const registerDate = `${y}-${formattedMonth}-${formattedDay}`;

        // SQL query to insert the purchase into the database
        const sql = `
        INSERT INTO purchases(userPhoneNumb, items, totalPrice, registerDate)
        VALUES (?, ?, ?, ?);
        `;

        // Execute the SQL query to insert the purchase
        const [newPurchase, _] = await db.execute(sql, [this.userPhoneNumb, this.items, this.totalPrice, registerDate]);

        const itemIds = this.items.split(',');

        for (const productId of itemIds) {
            await Product.updateStock(productId, 1);
        }
        return newPurchase;
    }

    // Static method to check if the user has previously bought any of the products currently on offer
    static async checkIfBoughtOnOffer(userPhoneNumb, productIds) {
        // Query to retrieve all purchases made by the user
        const userPurchasesSql = `
            SELECT items FROM purchases WHERE userPhoneNumb = ?;
        `;
        const [userPurchases] = await db.execute(userPurchasesSql, [userPhoneNumb]);

        // Flatten the list of product IDs from the user's purchases into a single array
        let purchasedProductIds = userPurchases.flatMap(purchase =>
            purchase.items.split(',').map(item => item.trim())
        );

        // Remove duplicate product IDs since we only need to know if the product was bought at least once
        purchasedProductIds = [...new Set(purchasedProductIds)];

        // Query to find products that are currently discounted
        const discountedProductsSql = 'SELECT product_id FROM products WHERE discount_amount > 0';
        const [discountedProducts] = await db.execute(discountedProductsSql);

        // Map discounted product IDs to strings for comparison
        const discountedProductIds = discountedProducts.map(product => product.product_id.toString());

        // Check each product ID against the list of discounted and previously purchased products
        for (const productId of productIds) {
            const productIdStr = productId.toString().trim();
            // If a product is both discounted and previously purchased, return true
            if (discountedProductIds.includes(productIdStr) && purchasedProductIds.includes(productIdStr)) {
                return true;
            }
        }

        // If none of the products being checked match the criteria, return false
        return false;
    }
}

module.exports = Purchase;
