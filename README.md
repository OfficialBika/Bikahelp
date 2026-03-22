# Telegram Powerful Help Bot

## Files
- `index.js` — main bot file
- `package.json` — dependencies and start scripts
- `.env.example` — environment template

## VPS Deploy
```bash
sudo apt update
sudo apt install -y nodejs npm
mkdir -p ~/powerful-help-bot
cd ~/powerful-help-bot
# upload files here
cp .env.example .env
nano .env
npm install
npm run check
npm start
```

## PM2 Run
```bash
sudo npm install -g pm2
pm2 start index.js --name powerful-help-bot
pm2 save
pm2 logs powerful-help-bot
```

## Required ENV
- `BOT_TOKEN`
- `MONGODB_URI`
- `OWNER_ID`
- `BOT_USERNAME`
- `TZ`
