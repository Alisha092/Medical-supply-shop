const http = require('http');
const { route } = require('./router');
require('dotenv').config();
const PORT = process.env.PORT;

const server = http.createServer((req, res) => route(req, res));

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});


