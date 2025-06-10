const express = require('express');
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Store connected clients and their data
const connectedClients = new Map();
const serverData = new Map();

// Discord OAuth routes
app.get('/auth/discord', (req, res) => {
    const baseUrl = 'https://discord.com/api/oauth2/authorize';
    const params = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
        response_type: 'code',
        scope: 'identify guilds'
    });
    res.redirect(`${baseUrl}?${params.toString()}`);
});

app.get('/auth/discord/callback', async (req, res) => {
    try {
        const { code } = req.query;
        const params = new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: process.env.DISCORD_REDIRECT_URI
        });

        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
        });

        req.session.user = userResponse.data;
        req.session.token = tokenResponse.data.access_token;
        res.redirect('/');
    } catch (error) {
        console.error('Discord auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// API Routes
app.get('/api/user', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json(req.session.user);
});

app.post('/api/playlist', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    // TODO: Implement playlist creation logic
    res.json({ success: true });
});

app.post('/api/platform/toggle', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    const { platform, enabled } = req.body;
    // TODO: Implement platform toggle logic
    res.json({ success: true });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('join-server', (serverId) => {
        socket.join(serverId);
        if (!serverData.has(serverId)) {
            serverData.set(serverId, {
                currentTrack: null,
                queue: [],
                stats: {
                    songsPlayed: 0,
                    activeUsers: 0,
                    playlistCount: 0,
                    totalPlaytime: 0,
                    memberCount: 0,
                    status: 'Bot Active'
                },
                settings: {
                    platforms: {
                        spotify: true,
                        youtube: true,
                        soundcloud: false,
                        apple: false
                    }
                }
            });
        }
        
        // Emit initial server data
        socket.emit('server-data', serverData.get(serverId));
        
        // Start emitting server stats updates
        const statsInterval = setInterval(() => {
            const server = serverData.get(serverId);
            if (server) {
                // Update stats with real data from bot
                server.stats.songsPlayed += Math.floor(Math.random() * 5); // Temporary random increment
                server.stats.activeUsers = Math.floor(Math.random() * 100) + 50; // Temporary random number
                server.stats.totalPlaytime += 0.1;
                
                // Emit updated stats
                io.to(serverId).emit('server-stats', server.stats);
            }
        }, 5000); // Update every 5 seconds

        // Clean up interval on disconnect
        socket.on('disconnect', () => {
            clearInterval(statsInterval);
        });
    });

    socket.on('update-track', (data) => {
        const { serverId, track } = data;
        if (serverData.has(serverId)) {
            const server = serverData.get(serverId);
            server.currentTrack = track;
            io.to(serverId).emit('track-update', track);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
