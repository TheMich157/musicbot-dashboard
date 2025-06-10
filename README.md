

---

# MusicBot - Dashboard

A web dashboard for managing a Discord Music Bot. The application allows users to control music playback, manage playlists, configure AI music preferences, and toggle music platforms.

## Project Overview

MusicBot is a powerful tool integrated with Discord, providing functionalities to play music from various platforms directly through a Discord server. It features a user-friendly web dashboard for easy management and configuration. 

## Installation

To set up the MusicBot dashboard locally, follow these steps:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/musicbot-dashboard.git
   cd musicbot-dashboard
   ```

2. **Install dependencies:**
   Make sure you have Node.js and npm installed, then run:
   ```bash
   npm install
   ```

3. **Create a `.env` file:**
   Copy the `.env.example` file provided and update the credentials with your own Discord application data:
   ```plaintext
   DISCORD_CLIENT_ID=your_client_id
   DISCORD_CLIENT_SECRET=your_client_secret
   DISCORD_REDIRECT_URI=http://localhost:3000/auth/discord/callback
   SESSION_SECRET=your_session_secret
   PORT=3000
   DISCORD_BOT_TOKEN=your_bot_token
   ```

4. **Start the application:**
   For development:
   ```bash
   npm run dev
   ```

   For production:
   ```bash
   npm start
   ```

## Usage

1. Start your Discord bot using the `bot.js` file.
2. Access the dashboard by navigating to `http://localhost:3000` in your web browser.
3. Authenticate with Discord to use the bot features.
4. Use the dashboard to control music playback, manage playlists, and configure AI preferences.

## Features

- **Dashboard Overview:** View statistics about songs played, active users, and playlists.
- **Music Platform Management:** Toggle availability for platforms like Spotify and YouTube.
- **AI Music Preferences:** Configure settings for automatic music selection based on user mood.
- **Playlist Management:** Create, edit, and manage multiple playlists easily.

## Dependencies

This project requires the following Node.js packages:

- `axios` - for making HTTP requests.
- `discord.js` - to interact with the Discord API.
- `dotenv` - to manage environment variables.
- `express` - for building the web server.
- `express-session` - to handle user sessions.
- `socket.io` - for real-time communication between the server and clients.

You can find these dependencies in the `package.json` file.

## Project Structure

Here's an overview of the project structure:

```
/musicbot-dashboard
├── package.json
├── server.js            # Main server file
├── bot.js               # Discord bot logic
├── public
│   └── index.html       # Dashboard HTML structure
└── .env                 # Environment variables (not included for security reasons)
```

## License

This project is licensed under the MIT License. See the LICENSE file for details.

For any issues, please create an issue in the repository or reach out for support.
