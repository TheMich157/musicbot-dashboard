// Initialize Socket.IO connection
const socket = io();
let currentServerId = null;

// DOM Elements Cache
const elements = {
    nowPlaying: document.querySelector('.now-playing'),
    albumArt: document.querySelector('.album-art'),
    trackInfo: document.querySelector('.track-info'),
    playButton: document.querySelector('.control-btn.play'),
    progressBar: document.querySelector('.progress-fill'),
    queueList: document.querySelector('.queue-section'),
    platformToggles: document.querySelectorAll('.toggle-switch'),
    moodOptions: document.querySelectorAll('.mood-option'),
    accountSection: document.getElementById('account-section')
};

// State Management
const state = {
    isPlaying: true,
    currentTrack: null,
    queue: [],
    user: null,
    serverSettings: null
};

// Authentication
async function loginWithDiscord() {
    window.location.href = '/auth/discord';
}

async function checkAuthStatus() {
    try {
        const response = await fetch('/api/user');
        if (response.ok) {
            state.user = await response.json();
            updateAccountUI();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
    }
}

function updateAccountUI() {
    if (!elements.accountSection) return;

    if (state.user) {
        elements.accountSection.innerHTML = `
            <div class="content-section">
                <div class="section-title">
                    <i class="fas fa-user"></i>
                    User Account
                </div>
                <div class="user-profile">
                    <img src="https://cdn.discordapp.com/avatars/${state.user.id}/${state.user.avatar}.png" 
                         alt="Profile" 
                         class="profile-avatar">
                    <div class="profile-info">
                        <h3>${state.user.username}</h3>
                        <p>${state.user.email || 'No email provided'}</p>
                    </div>
                </div>
                <button class="btn btn-secondary" onclick="logout()">
                    <i class="fas fa-sign-out-alt"></i>
                    Logout
                </button>
            </div>
        `;
    } else {
        elements.accountSection.innerHTML = `
            <div class="content-section">
                <div class="section-title">
                    <i class="fas fa-user"></i>
                    User Account
                </div>
                <button class="btn" onclick="loginWithDiscord()">
                    <i class="fab fa-discord"></i>
                    Login with Discord
                </button>
            </div>
        `;
    }
}

// Platform Management
async function togglePlatform(platform) {
    if (!state.user) {
        showNotification('Please login first', 'error');
        return;
    }

    const platformCard = document.querySelector(`[data-platform="${platform}"]`);
    const toggleSwitch = platformCard.querySelector('.toggle-switch');
    
    try {
        const response = await fetch('/api/platform/toggle', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                platform,
                enabled: !toggleSwitch.classList.contains('active')
            })
        });

        if (response.ok) {
            toggleSwitch.classList.toggle('active');
            platformCard.classList.toggle('enabled');
            updatePlatformStats(platformCard);
        } else {
            throw new Error('Failed to toggle platform');
        }
    } catch (error) {
        showNotification('Failed to update platform settings', 'error');
        console.error('Platform toggle error:', error);
    }
}

function updatePlatformStats(platformCard) {
    const statsText = platformCard.querySelector('.platform-stats p');
    if (platformCard.classList.contains('enabled')) {
        const playCount = Math.floor(Math.random() * 3000) + 500;
        statsText.innerHTML = `<i class="fas fa-play-circle"></i>${playCount} songs played this week`;
    } else {
        statsText.innerHTML = `<i class="fas fa-pause-circle"></i>Disabled`;
    }
}

// Playlist Management
async function createPlaylist() {
    if (!state.user) {
        showNotification('Please login first', 'error');
        return;
    }

    const name = prompt('Enter playlist name:');
    if (!name) return;

    try {
        const response = await fetch('/api/playlist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name })
        });

        if (response.ok) {
            const playlistList = document.querySelector('.playlist-list');
            const newPlaylistHTML = `
                <div class="playlist-item">
                    <div class="playlist-cover">
                        <i class="fas fa-music"></i>
                    </div>
                    <div class="playlist-info">
                        <div class="playlist-name">${name}</div>
                        <div class="playlist-stats">0 songs • Just created • 0 plays</div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="control-btn" title="Play">
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="control-btn" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </div>
            `;
            playlistList.insertAdjacentHTML('beforeend', newPlaylistHTML);
            showNotification('Playlist created successfully', 'success');
        } else {
            throw new Error('Failed to create playlist');
        }
    } catch (error) {
        showNotification('Failed to create playlist', 'error');
        console.error('Playlist creation error:', error);
    }
}

// Music Controls
function togglePlayback() {
    if (!state.currentTrack) return;

    const icon = elements.playButton.querySelector('i');
    if (state.isPlaying) {
        icon.className = 'fas fa-play';
        elements.albumArt.style.animationPlayState = 'paused';
    } else {
        icon.className = 'fas fa-pause';
        elements.albumArt.style.animationPlayState = 'running';
    }
    state.isPlaying = !state.isPlaying;

    // Emit playback state change to server
    socket.emit('playback-update', {
        serverId: currentServerId,
        isPlaying: state.isPlaying
    });
}

// Socket.IO Event Handlers
socket.on('connect', () => {
    console.log('Connected to server');
    if (currentServerId) {
        socket.emit('join-server', currentServerId);
    }
});

// Handle server stats updates
socket.on('server-stats', (stats) => {
    // Update server info
    const serverStats = document.getElementById('server-stats');
    if (serverStats) {
        serverStats.textContent = `${stats.memberCount} members • ${stats.status}`;
    }

    // Update stat cards
    const songsPlayed = document.getElementById('songs-played');
    if (songsPlayed) {
        songsPlayed.textContent = stats.songsPlayed.toLocaleString();
    }

    const activeUsers = document.getElementById('active-users');
    if (activeUsers) {
        activeUsers.textContent = stats.activeUsers.toLocaleString();
    }

    const playlistCount = document.getElementById('playlist-count');
    if (playlistCount) {
        playlistCount.textContent = stats.playlistCount.toLocaleString();
    }

    const totalPlaytime = document.getElementById('total-playtime');
    if (totalPlaytime) {
        totalPlaytime.textContent = `${stats.totalPlaytime.toFixed(1)}h`;
    }
});

socket.on('track-update', (track) => {
    state.currentTrack = track;
    updateNowPlaying(track);
});

socket.on('server-data', (data) => {
    state.serverSettings = data.settings;
    state.currentTrack = data.currentTrack;
    state.queue = data.queue;
    updateUI();
});

// UI Updates
function updateNowPlaying(track) {
    if (!track) {
        elements.trackInfo.innerHTML = `
            <h3>No track playing</h3>
            <p class="track-artist">-</p>
        `;
        return;
    }

    elements.trackInfo.innerHTML = `
        <h3>${track.title}</h3>
        <p class="track-artist">${track.artist}</p>
    `;

    // Update album art if provided
    if (track.albumArt) {
        elements.albumArt.innerHTML = `<img src="${track.albumArt}" alt="Album Art">`;
    }
}

function updateUI() {
    // Update platform toggles
    if (state.serverSettings?.platforms) {
        Object.entries(state.serverSettings.platforms).forEach(([platform, enabled]) => {
            const card = document.querySelector(`[data-platform="${platform}"]`);
            if (card) {
                const toggle = card.querySelector('.toggle-switch');
                toggle.classList.toggle('active', enabled);
                card.classList.toggle('enabled', enabled);
                updatePlatformStats(card);
            }
        });
    }

    // Update current track
    if (state.currentTrack) {
        updateNowPlaying(state.currentTrack);
    }

    // Update queue
    updateQueue();
}

function updateQueue() {
    const queueContainer = document.querySelector('.queue-section');
    if (!queueContainer) return;

    const queueHTML = state.queue.map(track => `
        <div class="queue-item">
            <div class="queue-thumb">
                <i class="fas fa-music"></i>
            </div>
            <div class="queue-info">
                <div class="queue-title">${track.title}</div>
                <div class="queue-artist">${track.artist}</div>
            </div>
        </div>
    `).join('');

    queueContainer.innerHTML = `
        <div class="queue-header">
            <h3>Up Next</h3>
            <button class="btn btn-secondary">
                <i class="fas fa-random"></i>
            </button>
        </div>
        ${queueHTML}
    `;
}

// Notifications
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i>
        ${message}
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Navigation
function showSection(sectionName) {
    document.querySelectorAll('.section-content').forEach(section => {
        section.style.display = 'none';
    });
    
    document.getElementById(sectionName + '-section').style.display = 'block';
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
    
    // Add event listeners
    elements.playButton?.addEventListener('click', togglePlayback);
    elements.platformToggles?.forEach(toggle => {
        if (!toggle.onclick) {
            toggle.addEventListener('click', () => {
                toggle.classList.toggle('active');
            });
        }
    });
    elements.moodOptions?.forEach(option => {
        option.addEventListener('click', () => {
            option.classList.toggle('selected');
        });
    });

    // Start progress bar animation
    setInterval(() => {
        if (state.isPlaying && elements.progressBar) {
            let currentWidth = parseInt(elements.progressBar.style.width) || 35;
            currentWidth = (currentWidth + 0.5) % 100;
            elements.progressBar.style.width = currentWidth + '%';
        }
    }, 1000);
});
