# Living Letter

A personal website that functions as a living letter with marginal annotations. Visitors can click notes in the margins to write responses, which are saved to a database.

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│   GitHub Pages      │     │      Railway        │
│   (Frontend)        │────▶│   (Backend + DB)    │
│                     │     │                     │
│  - index.html       │     │  - server.js        │
│  - admin.html       │     │  - PostgreSQL       │
│  - status.html      │     │                     │
└─────────────────────┘     └─────────────────────┘
```

- **Frontend**: Static HTML/CSS/JS hosted on GitHub Pages
- **Backend**: Node.js API hosted on Railway
- **Database**: PostgreSQL on Railway

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start backend server (uses SQLite locally)
npm run dev

# In another terminal, serve frontend
python3 -m http.server 8000

# Visit http://localhost:8000
```

### Production Deployment

#### 1. Deploy Frontend to GitHub Pages

1. Push this repo to GitHub
2. Go to Settings → Pages → Enable from main branch
3. Your site is live at `https://username.github.io/repo-name`

#### 2. Deploy Backend to Railway

1. Go to [railway.app](https://railway.app) and create account
2. New Project → Deploy from GitHub repo
3. Add PostgreSQL database:
   - Click **"+ New"** → **"Database"** → **"PostgreSQL"**
   - Railway auto-links it to your service
4. Get your Railway URL from the service settings
5. Update `js/config.js` with your Railway URL:

```javascript
RAILWAY_URL: 'https://your-app.up.railway.app',
```

6. Push the config change to GitHub

#### 3. Verify Deployment

Visit `status.html` on your GitHub Pages site to check all connections.

## File Structure

```
├── index.html          # Main letter page
├── admin.html          # View submitted notes
├── status.html         # System status/diagnostics
├── writing.html        # Writing page (placeholder)
├── reading.html        # Reading list
├── css/
│   └── styles.css      # All styles
├── js/
│   ├── config.js       # ⚡ API URL configuration (edit this!)
│   └── app.js          # Frontend interactions
├── server.js           # Backend API server
├── package.json        # Node.js dependencies
├── nixpacks.toml       # Railway build config
├── railway.json        # Railway deploy config
└── Procfile            # Process definition
```

## Configuration

**The only file you need to edit after deploying:**

`js/config.js` - Update `RAILWAY_URL` with your Railway backend URL.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check + database status |
| `/api/submit` | POST | Submit a note response |
| `/api/notes` | GET | Retrieve all submitted notes |

## How It Works

1. **Visitor reads the letter** on `index.html`
2. **Clicks a marginal note** → Opens a response window
3. **Submits a response** → Sent to Railway backend
4. **Backend saves to PostgreSQL** → Returns success
5. **You view responses** at `admin.html`

## Troubleshooting

**Check `status.html`** - It shows:
- Backend server status
- Database connection
- Notes endpoint

**Common issues:**

| Problem | Solution |
|---------|----------|
| "Failed to fetch" | Backend not deployed or wrong URL in config.js |
| "Database not connected" | PostgreSQL not added to Railway project |
| "Detected Staticfile" in Railway | nixpacks.toml should force Node.js detection |

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS (no framework)
- **Backend**: Node.js with native `http` module
- **Database**: PostgreSQL (Railway) / SQLite (local)
- **Hosting**: GitHub Pages (frontend) + Railway (backend)

## License

Personal use. Customize freely.
