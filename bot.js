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

// Store active music connections
const musicConnections = new Map();

// Music platform handlers
const platforms = {
    spotify: {
        enabled: true,
        search: async (query) => {
            // TODO: Implement Spotify search
            return [];
        }
    },
    youtube: {
        enabled: true,
        search: async (query) => {
            // TODO: Implement YouTube search
            return [];
        }
    },
    soundcloud: {
        enabled: false,
        search: async (query) => {
            // TODO: Implement SoundCloud search
            return [];
        }
    }
};

// Bot commands handler
const commands = {
    play: async (message, args) => {
        try {
            const query = args.join(' ');
            const guildId = message.guild.id;
            
            // Search across enabled platforms
            let tracks = [];
            for (const [platform, handler] of Object.entries(platforms)) {
                if (handler.enabled) {
                    const results = await handler.search(query);
                    tracks = [...tracks, ...results];
                }
            }

            if (tracks.length === 0) {
                return message.reply('No tracks found!');
            }

            // Update the current track in the web dashboard
            socket.emit('update-track', {
                serverId: guildId,
                track: tracks[0]
            });

            message.reply(`Now playing: ${tracks[0].title}`);
        } catch (error) {
            console.error('Error in play command:', error);
            message.reply('Failed to play the track. Please try again.');
        }
    },

    stop: (message) => {
        const guildId = message.guild.id;
        // TODO: Implement stop logic
        socket.emit('update-track', {
            serverId: guildId,
            track: null
        });
        message.reply('Playback stopped.');
    },

    skip: (message) => {
        // TODO: Implement skip logic
        message.reply('Skipped to next track.');
    },

    queue: (message) => {
        // TODO: Implement queue display
        message.reply('Queue is empty.');
    }
};

// Event handlers
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity('🎵 Music | /help', { type: ActivityType.Playing });
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
