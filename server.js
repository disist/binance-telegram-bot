const http = require('http');
const port = process.env.port || 3000;
console.log('PORT is', port);
const requestHandler = (request, response) => {
    response.end('The bot is running, everything is ok!');
}
const server = http.createServer(requestHandler);
server.listen(port, (err) => {
    if (err) {
        return console.log('something bad happened', err);
    }
    console.log(`server is listening on ${port}`)
});