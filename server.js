const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const fs = require('fs');

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function(req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded.' });
    }

    // Emit the uploaded image information to the specific room
    const room = req.body.room;
    io.to(room).emit('imageUploaded', {
        filename: req.file.filename,
        path: req.file.path
    });

    res.json({
        filename: req.file.filename,
        path: req.file.path
    });
});
const chatLogPath = path.join(__dirname, 'chat_logs.txt'); // File tempat menyimpan log

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });

    socket.on('join room', ({ username, room }) => {
        socket.join(room);
        socket.username = username;
        socket.room = room;

        io.to(room).emit('user joined', username);
    });

    socket.on('chat message', (msg) => {
        if (!msg || msg.length > 500) {
            socket.emit('error', 'Invalid or too long message');
            return;
        }

        const currentTime = new Date().toLocaleTimeString('en-US', { hour12: false });
        const chatLog = {
            jam: currentTime,
            user: socket.username,
            room: socket.room,
            pesam: msg
        };

        logChatToFile(chatLog); // Menyimpan log ke file

        io.to(socket.room).emit('chat message', { sender: socket.username, message: msg });
    });
});

server.listen(8080, () => {
    console.log('Server is running on port 8080');
});
function logChatToFile(logData) {
    const logEntry = JSON.stringify(logData, null, 2) + ',\n'; // Format JSON dengan indentasi dan koma
    fs.appendFileSync(chatLogPath, logEntry, 'utf8');
}
app.get('/lihatchat', (req, res) => {
    // Membaca file chat_logs.txt
    fs.readFile(chatLogPath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading chat log file:', err);
            return res.status(500).send('Error reading chat log file.');
        }

        // Mengirim data log sebagai respons
        res.setHeader('Content-Type', 'text/plain');
        res.send(data);
    });
});