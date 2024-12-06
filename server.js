// server.js

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

// 初始化 express 應用
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// 靜態文件路徑
app.use(express.static('public'));

// 當客戶端連接時觸發
io.on('connection', (socket) => {
    console.log('新用戶連接');

    // 當收到客戶端發送的消息時
    socket.on('chatMessage', (msg) => {
        // 將消息廣播給所有連接的客戶端
        io.emit('chatMessage', msg);
    });

    // 當客戶端斷開連接時
    socket.on('disconnect', () => {
        console.log('用戶斷開連接');
    });
});

// 啟動服務器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服務器運行在 http://localhost:${PORT}`);
});
