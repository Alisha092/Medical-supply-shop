const db = require('../config/db');

class Cart {
    // Adds a product to the cart. If the product already exists, it updates the quantity.
    static async addToCart(productId, sessionId, quantity = 1) {
        try {
            // Check if the product is already in the cart for the given session
            const [existing] = await db.execute('SELECT * FROM cart_items WHERE product_id = ? AND session_id = ?', [productId, sessionId]);

            if (existing.length > 0) {
                // Product exists, so update its quantity
                await db.execute('UPDATE cart_items SET quantity = quantity + ? WHERE product_id = ? AND session_id = ?', [quantity, productId, sessionId]);
            } else {
                // Product doesn't exist, so add it to the cart
                await db.execute('INSERT INTO cart_items (product_id, quantity, session_id) VALUES (?, ?, ?)', [productId, quantity, sessionId]);
            }
            return true;
        } catch (error) {
            console.error('Error adding to cart:', error);
            throw error; // Propagate the error
        }
    }

    // Retrieves all cart items for a given session
    static async getCartItems(sessionId) {
        try {
            try {
                let sql = `SELECT product_id, quantity FROM cart_items WHERE session_id = ?`;
                const [cartItems] = await db.execute(sql, [sessionId]);
                return cartItems;
            } catch (error) {
                console.error("Error fetching cart items:", error);
                throw error;
            }
        } catch (error) {
            console.error("Error fetching cart items:", error);
            throw error;
        }
    }


    // Retrieves only product IDs from the cart for a given session
    static async getProductIds(sessionId) {
        let sql = `SELECT product_id FROM cart_items WHERE session_id = ?`;
        const [productIds] = await db.execute(sql, [sessionId]);
        return productIds.map(item => item.product_id);
    }

    // Deletes a specific product from the cart or adjusts its quantity
    static async deleteFromCart(product_id, session_id) {
        try {
            await db.execute('DELETE FROM cart_items WHERE product_id = ? AND session_id = ?', [product_id, session_id]);
            console.log(`Product with ID ${product_id} deleted from cart for session ${session_id}`);
        } catch (error) {
            console.error('Error deleting from cart:', error);
            throw error; // Propagate the error
        }
    }

    // Clears all items from the cart for a given session
    static async clearCart(sessionId) {
        let sql = `DELETE FROM cart_items WHERE session_id = ?`;
        await db.execute(sql, [sessionId]);
    }

    // Calculates the total price of all items in the cart for a given session
    static async calculateTotalPrice(sessionId) {
        let sql = `
            SELECT 
                ci.quantity, 
                p.price, 
                p.discount_amount,
                (p.price - (p.price * COALESCE(p.discount_amount, 0) / 100)) AS final_price, 
                (p.price - (p.price * COALESCE(p.discount_amount, 0) / 100)) * ci.quantity AS total_price
            FROM 
                cart_items ci 
                JOIN products p ON ci.product_id = p.product_id 
            WHERE 
                ci.session_id = ?
        `;

        try {
            const [cartItems] = await db.execute(sql, [sessionId]);
            // Calculate the total price by summing up the individual total prices of all cart items
            const totalPrice = cartItems.reduce((acc, item) => acc + item.total_price, 0);
            return totalPrice;
        } catch (error) {
            console.error('Error calculating total price:', error);
            throw error; // Propagate the error
        }
    }
}

module.exports = Cart;
