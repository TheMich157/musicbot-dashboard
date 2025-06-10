// Navigation functionality
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section-content').forEach(section => {
        section.style.display = 'none';
    });
    
    // Show selected section
    document.getElementById(sectionName + '-section').style.display = 'block';
    
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
}

// Platform toggle functionality
function togglePlatform(platform) {
    const platformCard = document.querySelector(`[data-platform="${platform}"]`);
    const toggleSwitch = platformCard.querySelector('.toggle-switch');
    
    toggleSwitch.classList.toggle('active');
    platformCard.classList.toggle('enabled');
    
    // Update stats text
    const statsText = platformCard.querySelector('.platform-stats p');
    if (platformCard.classList.contains('enabled')) {
        const playCount = Math.floor(Math.random() * 3000) + 500;
        statsText.innerHTML = `<i class="fas fa-play-circle" style="margin-inline-end: 0.5rem;"></i>${playCount} songs played this week`;
    } else {
        statsText.innerHTML = `<i class="fas fa-pause-circle" style="margin-inline-end: 0.5rem;"></i>Disabled`;
    }
}

// Mood selection functionality
document.querySelectorAll('.mood-option').forEach(option => {
    option.addEventListener('click', function() {
        this.classList.toggle('selected');
    });
});

// Navigation event listeners
document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        const section = this.getAttribute('data-section');
        showSection(section);
    });
});

// Playlist creation functionality
function createPlaylist() {
    const playlistName = prompt('Enter playlist name:');
    if (playlistName) {
        const playlistList = document.querySelector('.playlist-list');
        const newPlaylistHTML = `
            <div class="playlist-item">
                <div class="playlist-cover">
                    <i class="fas fa-music"></i>
                </div>
                <div class="playlist-info">
                    <div class="playlist-name">${playlistName}</div>
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
    }
}

// Music controls functionality
let isPlaying = true;
document.querySelector('.control-btn.play').addEventListener('click', function() {
    const icon = this.querySelector('i');
    if (isPlaying) {
        icon.className = 'fas fa-play';
        this.closest('.now-playing').querySelector('.album-art').style.animationPlayState = 'paused';
    } else {
        icon.className = 'fas fa-pause';
        this.closest('.now-playing').querySelector('.album-art').style.animationPlayState = 'running';
    }
    isPlaying = !isPlaying;
});

// Progress bar animation
setInterval(() => {
    if (isPlaying) {
        const progressFill = document.querySelector('.progress-fill');
        let currentWidth = parseInt(progressFill.style.width) || 35;
        currentWidth += 0.5;
        if (currentWidth > 100) currentWidth = 0;
        progressFill.style.width = currentWidth + '%';
    }
}, 1000);

// Toggle switches functionality
document.querySelectorAll('.toggle-switch').forEach(toggle => {
    toggle.addEventListener('click', function() {
        if (!this.onclick) { // Only handle generic toggles
            this.classList.toggle('active');
        }
    });
});

// Add some dynamic stats updates
setInterval(() => {
    const statNumbers = document.querySelectorAll('.stat-number');
    statNumbers.forEach(stat => {
        if (stat.textContent.includes(',')) {
            let currentValue = parseInt(stat.textContent.replace(',', ''));
            currentValue += Math.floor(Math.random() * 10) + 1;
            stat.textContent = currentValue.toLocaleString();
        }
    });
}, 5000);

// Initialize Socket.IO connection
const socket = io();

// Listen for server stats updates
socket.on('serverStats', (data) => {
    document.getElementById('songs-played').textContent = data.songsPlayed.toLocaleString();
    document.getElementById('active-users').textContent = data.activeUsers.toLocaleString();
    document.getElementById('playlist-count').textContent = data.playlistCount.toLocaleString();
    document.getElementById('total-playtime').textContent = data.totalPlaytime;
    document.getElementById('server-stats').textContent = `${data.members} members • Bot Active`;
});
