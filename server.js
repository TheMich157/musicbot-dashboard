const express = require('express');
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const axios = require('axios');
const { ConvexHttpClient } = require('convex/server');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Initialize Convex client
const convex = new ConvexHttpClient(process.env.CONVEX_URL);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Allow non-HTTPS for development
}));

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session && req.session.user) {
        next();
    } else {
        res.redirect('/');
    }
};

// Serve signin.html at the root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'signin.html'));
});

// Serve signup.html at /signup
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'signup.html'));
});

// Sign-in route
app.post('/signin', (req, res) => {
    const { username, password } = req.body;
    // Replace with your authentication logic
    if (username === 'user' && password === 'password') {
        req.session.user = { username: username };
        res.redirect('/index.html');
    } else {
        res.status(401).send('Authentication failed');
    }
});

// Signup route
app.post('/signup', (req, res) => {
    const { email, username, password, confirmPassword } = req.body;
    if (!email || !username || !password || !confirmPassword) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match' });
    }
    if (!req.session.discordLinked) {
        return res.status(401).json({ error: 'Discord account must be linked', requiresDiscordLink: true });
    }
    // TODO: Save the new user into the database (dummy logic for now)
    req.session.user = { email, username, discord: req.session.discordData };
    res.json({ success: true });
});

// Serve index.html only to authenticated users
app.get('/index.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Store connected clients and their data
const connectedClients = new Map();
const serverData = new Map();

// Bot status tracking
const botStatus = {
    connectedServers: new Set(),
    activeTracks: new Map(),
    serverStats: new Map()
};

// API Routes for bot data
app.get('/api/servers', (req, res) => {
    const servers = Array.from(botStatus.connectedServers).map(serverId => {
        const stats = botStatus.serverStats.get(serverId) || {};
        return {
            id: serverId,
            stats: stats,
            currentTrack: botStatus.activeTracks.get(serverId)
        };
    });
    res.json(servers);
});

app.get('/api/server/:serverId', (req, res) => {
    const { serverId } = req.params;
    if (!botStatus.connectedServers.has(serverId)) {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    res.json({
        id: serverId,
        stats: botStatus.serverStats.get(serverId) || {},
        currentTrack: botStatus.activeTracks.get(serverId)
    });
});

 // Discord OAuth routes
 app.get('/auth/discord', (req, res) => {
     const baseUrl = 'https://discord.com/api/oauth2/authorize';
     const params = new URLSearchParams({
         client_id: process.env.DISCORD_CLIENT_ID,
         redirect_uri: process.env.DISCORD_REDIRECT_URI,
         response_type: 'code',
         scope: 'identify guilds'
     });
     // Pass along redirect query param if present
     if (req.query.redirect) {
         params.append('state', req.query.redirect);
     }
     res.redirect(`${baseUrl}?${params.toString()}`);
 });

 app.get('/auth/discord/callback', async (req, res) => {
     try {
         const { code, state } = req.query;
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

         if (state === 'signup') {
             req.session.discordLinked = true;
             req.session.discordData = userResponse.data;
             return res.redirect('/signup');
         }

         req.session.user = userResponse.data;
         req.session.token = tokenResponse.data.access_token;
         res.redirect('/');
     } catch (error) {
         console.error('Discord auth error:', error);
         res.status(500).json({ error: 'Authentication failed' });
     }
 });

// API Routes - require authentication
app.get('/api/user', requireAuth, (req, res) => {
    res.json({
        authenticated: true,
        user: req.session.user
    });
});

app.post('/api/playlist', requireAuth, (req, res) => {
    // TODO: Implement playlist creation logic
    res.json({ success: true });
});

app.post('/api/platform/toggle', requireAuth, (req, res) => {
    const { platform, enabled } = req.body;
    // TODO: Implement platform toggle logic
    res.json({ success: true });
});

// Removed mock server data endpoint to use real-time data from bot

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('join-server', (serverId) => {
        socket.join(serverId);
        if (!serverData.has(serverId)) {
            serverData.set(serverId, {
                currentTrack: botStatus.activeTracks.get(serverId) || null,
                queue: [],
                stats: botStatus.serverStats.get(serverId) || {
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
    });

    // Handle bot events
    socket.on('bot-server-join', (serverId) => {
        botStatus.connectedServers.add(serverId);
        io.emit('server-update', { type: 'join', serverId });
    });

    socket.on('bot-server-leave', (serverId) => {
        botStatus.connectedServers.delete(serverId);
        botStatus.activeTracks.delete(serverId);
        botStatus.serverStats.delete(serverId);
        io.emit('server-update', { type: 'leave', serverId });
    });

    socket.on('bot-track-update', (data) => {
        const { serverId, track } = data;
        botStatus.activeTracks.set(serverId, track);
        io.to(serverId).emit('track-update', track);
    });

    socket.on('bot-stats-update', (data) => {
        const { serverId, stats } = data;
        botStatus.serverStats.set(serverId, stats);
        io.to(serverId).emit('server-stats', stats);
    });

    // Handle client commands
    socket.on('play-track', async (data) => {
        const { serverId, query } = data;
        try {
            // Forward play command to bot
            io.emit('bot-command', {
                type: 'play',
                serverId,
                data: { query }
            });
        } catch (error) {
            socket.emit('error', { message: 'Failed to play track' });
        }
    });

    socket.on('stop-playback', (serverId) => {
        io.emit('bot-command', {
            type: 'stop',
            serverId
        });
    });

    socket.on('skip-track', (serverId) => {
        io.emit('bot-command', {
            type: 'skip',
            serverId
        });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
        // Clear any intervals that might be running for this socket
        if (socket.statsInterval) {
            clearInterval(socket.statsInterval);
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = 8000;  // Use port 8000 as specified
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
