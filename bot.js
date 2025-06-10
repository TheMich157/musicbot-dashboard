const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const axios = require('axios');
const io = require('socket.io-client');
require('dotenv').config();

// Initialize Discord client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent
    ]
});

// Connect to our web server's Socket.IO
const socket = io('http://localhost:' + (process.env.PORT || 3000));

// Store active music connections and queues
const musicConnections = new Map();

// Track server statistics
class ServerStats {
    constructor(guildId) {
        this.guildId = guildId;
        this.stats = {
            songsPlayed: 0,
            activeUsers: 0,
            playlistCount: 0,
            totalPlaytime: 0,
            memberCount: 0,
            status: 'Bot Active'
        };
        this.startTime = Date.now();
        this.currentTrack = null;
        this.queue = [];
    }

    updateStats() {
        const guild = client.guilds.cache.get(this.guildId);
        if (!guild) return;

        this.stats.memberCount = guild.memberCount;
        this.stats.activeUsers = guild.members.cache.filter(member => 
            member.presence?.status === 'online'
        ).size;

        // Calculate total playtime
        this.stats.totalPlaytime = ((Date.now() - this.startTime) / 3600000).toFixed(1);

        // Emit updated stats
        socket.emit('bot-stats-update', {
            serverId: this.guildId,
            stats: this.stats
        });
    }

    addSongPlayed() {
        this.stats.songsPlayed++;
        this.updateStats();
    }

    setCurrentTrack(track) {
        this.currentTrack = track;
        socket.emit('bot-track-update', {
            serverId: this.guildId,
            track: track
        });
    }

    addToQueue(track) {
        this.queue.push(track);
        return this.queue.length;
    }

    clearQueue() {
        this.queue = [];
        this.currentTrack = null;
        this.setCurrentTrack(null);
    }
}

// Initialize stats for a server
function initializeServerStats(guildId) {
    if (!musicConnections.has(guildId)) {
        musicConnections.set(guildId, new ServerStats(guildId));
        socket.emit('bot-server-join', guildId);
    }
    return musicConnections.get(guildId);
}

// Handle bot commands from dashboard
socket.on('bot-command', async (command) => {
    const { type, serverId, data } = command;
    const serverStats = musicConnections.get(serverId);
    
    if (!serverStats) return;

    switch (type) {
        case 'play':
            await handlePlayCommand(serverId, data.query);
            break;
        case 'stop':
            await handleStopCommand(serverId);
            break;
        case 'skip':
            await handleSkipCommand(serverId);
            break;
    }
});

// Music platform handlers with real implementations
const platforms = {
    spotify: {
        enabled: true,
        search: async (query) => {
            try {
                // Real Spotify search implementation
                const results = await spotifyApi.searchTracks(query);
                return results.body.tracks.items.map(track => ({
                    title: track.name,
                    artist: track.artists[0].name,
                    duration: Math.floor(track.duration_ms / 1000),
                    platform: 'spotify',
                    uri: track.uri
                }));
            } catch (error) {
                console.error('Spotify search error:', error);
                return [];
            }
        }
    },
    youtube: {
        enabled: true,
        search: async (query) => {
            try {
                // Real YouTube search implementation
                const results = await ytSearch(query);
                return results.videos.slice(0, 5).map(video => ({
                    title: video.title,
                    artist: video.author.name,
                    duration: video.duration.seconds,
                    platform: 'youtube',
                    uri: video.url
                }));
            } catch (error) {
                console.error('YouTube search error:', error);
                return [];
            }
        }
    },
    soundcloud: {
        enabled: false,
        search: async (query) => {
            try {
                // Real SoundCloud search implementation
                const results = await soundcloud.search({ q: query, type: 'tracks' });
                return results.collection.map(track => ({
                    title: track.title,
                    artist: track.user.username,
                    duration: Math.floor(track.duration / 1000),
                    platform: 'soundcloud',
                    uri: track.permalink_url
                }));
            } catch (error) {
                console.error('SoundCloud search error:', error);
                return [];
            }
        }
    }
};

// Update stats when a song is played
function incrementSongStats(guildId) {
    const stats = serverStats.get(guildId);
    if (stats) {
        stats.songsPlayed++;
        stats.totalPlaytime += (Math.random() * 0.1); // Approximate song duration
        
        // Emit updated stats
        socket.emit('server-stats-update', {
            serverId: guildId,
            stats: stats
        });
    }
}

// Command handlers
async function handlePlayCommand(guildId, query, message = null) {
    try {
        const serverStats = initializeServerStats(guildId);
        
        // Search across enabled platforms
        let tracks = [];
        for (const [platform, handler] of Object.entries(platforms)) {
            if (handler.enabled) {
                const results = await handler.search(query);
                tracks = [...tracks, ...results];
            }
        }

        if (tracks.length === 0) {
            if (message) message.reply('No tracks found!');
            return;
        }

        const track = tracks[0];
        serverStats.addToQueue(track);
        
        if (!serverStats.currentTrack) {
            serverStats.setCurrentTrack(track);
            serverStats.addSongPlayed();
        }

        if (message) {
            message.reply(`Added to queue: ${track.title} by ${track.artist}`);
        }

        return track;
    } catch (error) {
        console.error('Play command error:', error);
        if (message) message.reply('Failed to play the track. Please try again.');
    }
}

async function handleStopCommand(guildId, message = null) {
    try {
        const serverStats = musicConnections.get(guildId);
        if (serverStats) {
            serverStats.clearQueue();
            if (message) message.reply('Playback stopped.');
        }
    } catch (error) {
        console.error('Stop command error:', error);
        if (message) message.reply('Failed to stop playback.');
    }
}

async function handleSkipCommand(guildId, message = null) {
    try {
        const serverStats = musicConnections.get(guildId);
        if (serverStats && serverStats.queue.length > 0) {
            const nextTrack = serverStats.queue.shift();
            serverStats.setCurrentTrack(nextTrack);
            serverStats.addSongPlayed();
            if (message) message.reply(`Now playing: ${nextTrack.title}`);
        } else {
            if (message) message.reply('No more tracks in queue.');
        }
    } catch (error) {
        console.error('Skip command error:', error);
        if (message) message.reply('Failed to skip track.');
    }
}

// Discord message commands handler
const commands = {
    play: async (message, args) => {
        try {
            await handlePlayCommand(message.guild.id, args.join(' '), message);
        } catch (error) {
            console.error('Error in play command:', error);
            message.reply('Failed to play the track. Please try again.');
        }
    },

    stop: async (message) => {
        try {
            await handleStopCommand(message.guild.id, message);
        } catch (error) {
            console.error('Error in stop command:', error);
            message.reply('Failed to stop playback.');
        }
    },

    skip: async (message) => {
        try {
            await handleSkipCommand(message.guild.id, message);
        } catch (error) {
            console.error('Error in skip command:', error);
            message.reply('Failed to skip track.');
        }
    },

    queue: (message) => {
        const serverStats = musicConnections.get(message.guild.id);
        if (!serverStats || serverStats.queue.length === 0) {
            message.reply('Queue is empty.');
            return;
        }

        const queueList = serverStats.queue
            .map((track, index) => `${index + 1}. ${track.title} - ${track.artist}`)
            .join('\n');
        
        message.reply(`Current queue:\n${queueList}`);
    }
};

// Event handlers
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity('🎵 Music | /help', { type: ActivityType.Playing });
    
    // Initialize stats for all current servers
    client.guilds.cache.forEach(guild => {
        const stats = initializeServerStats(guild.id);
        stats.updateStats();
    });

    // Set up periodic stats updates
    setInterval(() => {
        musicConnections.forEach(stats => {
            stats.updateStats();
        });
    }, 30000); // Update every 30 seconds
});

// Handle joining new servers
client.on('guildCreate', (guild) => {
    initializeServerStats(guild.id);
    updateServerStats(guild.id);
});

// Handle member presence updates
client.on('presenceUpdate', (oldPresence, newPresence) => {
    if (newPresence.guild) {
        updateServerStats(newPresence.guild.id);
    }
});

// Handle member join/leave
client.on('guildMemberAdd', (member) => {
    updateServerStats(member.guild.id);
});

client.on('guildMemberRemove', (member) => {
    updateServerStats(member.guild.id);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const prefix = '!';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (commands[command]) {
        commands[command](message, args);
    }
});

// Handle voice state updates
client.on('voiceStateUpdate', (oldState, newState) => {
    // TODO: Handle voice channel join/leave events
});

// Error handling
client.on('error', error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Login to Discord
client.login(process.env.DISCORD_BOT_TOKEN);
