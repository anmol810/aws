# AWS Deployment Guide — Todo App (EC2 + RDS)

## Architecture

```
Browser → EC2 (Node.js serves React + API) → RDS (PostgreSQL)
```

Your EC2 instance runs the Node server which:
- Serves the React frontend as static files (`/`)
- Handles all API calls (`/api/todos`)
- Talks to RDS over a private VPC connection

---

## Step 1 — Create RDS (PostgreSQL)

1. Go to **AWS Console → RDS → Create database**
2. Settings:
   - Engine: **PostgreSQL**
   - Template: **Free tier**
   - DB instance identifier: `todo-db`
   - Master username: `postgres`
   - Master password: pick a strong one, save it
   - Instance: `db.t3.micro`
3. Connectivity:
   - **Don't** make it publicly accessible (EC2 will talk to it privately)
   - VPC: use the **default VPC**
   - Create a new security group: `todo-rds-sg`
4. Click **Create database** — takes ~5 mins

After it's created, copy the **Endpoint** from the RDS console.
It looks like: `todo-db.xxxx.us-east-1.rds.amazonaws.com`

---

## Step 2 — Create EC2 Instance

1. Go to **AWS Console → EC2 → Launch Instance**
2. Settings:
   - Name: `todo-server`
   - AMI: **Ubuntu Server 22.04 LTS** (free tier eligible)
   - Instance type: `t2.micro`
   - Key pair: Create new → name it `todo-key` → download the `.pem` file
3. Network settings:
   - Allow SSH (port 22) from **My IP**
   - Allow HTTP (port 80) from **Anywhere**
   - Allow Custom TCP port **3001** from **Anywhere** (for now, can remove later)
4. Click **Launch Instance**

---

## Step 3 — Configure Security Groups

### EC2 Security Group (auto-created above)
Should already have:
- Port 22 (SSH) — your IP
- Port 80 (HTTP) — 0.0.0.0/0
- Port 3001 — 0.0.0.0/0

### RDS Security Group (`todo-rds-sg`)
You need to allow EC2 to reach RDS on port 5432:

1. Go to **RDS → your DB → Connectivity → Security group** → click the SG
2. Edit inbound rules → Add rule:
   - Type: **PostgreSQL** (port 5432)
   - Source: the **EC2 security group ID** (not IP — use the SG ID from EC2)
3. Save

---

## Step 4 — SSH into EC2 & Set Up the Server

```bash
# On your local machine — fix key permissions first
chmod 400 ~/Downloads/todo-key.pem

# SSH in (replace with your EC2 public IP)
ssh -i ~/Downloads/todo-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

Once inside EC2:

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Git
sudo apt-get install -y git

# Verify
node -v   # should be v20.x
npm -v
```

---

## Step 5 — Deploy the App

```bash
# Clone your repo (push to GitHub first — see Step 5a)
git clone https://github.com/YOUR_USERNAME/todo-app.git
cd todo-app

# Install dependencies
npm run install:all

# Build the React frontend
npm run build

# Create the .env file
cp server/.env.example server/.env
nano server/.env
```

Fill in your `.env`:
```
PORT=3001
DB_HOST=todo-db.xxxx.us-east-1.rds.amazonaws.com   # your RDS endpoint
DB_PORT=5432
DB_NAME=todos
DB_USER=postgres
DB_PASSWORD=your_rds_password
DB_SSL=true
```

Save and exit (`Ctrl+X`, `Y`, `Enter`).

```bash
# Test it runs
npm start
# Visit http://YOUR_EC2_IP:3001 — you should see the app
# Ctrl+C to stop
```

---

## Step 5a — Push to GitHub (do this locally first)

```bash
cd todo-app
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/todo-app.git
git push -u origin main
```

---

## Step 6 — Keep App Running with PM2

Without PM2, the app stops when you close SSH.

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the app
pm2 start npm --name "todo" -- start

# Make it restart on server reboot
pm2 startup
# Run the command it outputs (starts with "sudo env PATH=...")
pm2 save

# Useful PM2 commands
pm2 status        # see if app is running
pm2 logs todo     # view logs
pm2 restart todo  # restart
```

---

## Step 7 — (Optional) Run on Port 80 with Nginx

Right now the app runs on port 3001. Use Nginx to proxy port 80 → 3001
so users visit `http://your-ip` directly.

```bash
sudo apt-get install -y nginx

sudo nano /etc/nginx/sites-available/todo
```

Paste:
```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/todo /etc/nginx/sites-enabled/
sudo nginx -t         # test config
sudo systemctl restart nginx

# Now remove port 3001 from EC2 security group (optional cleanup)
```

---

## Step 8 — (Optional) Add a Domain + HTTPS

1. Buy a domain (Route 53 or external registrar)
2. In Route 53, create an **A record** pointing to your EC2 public IP
3. Install Certbot for free SSL:

```bash
sudo snap install --classic certbot
sudo certbot --nginx -d yourdomain.com
```

Certbot auto-renews. Your app is now HTTPS. 🎉

---

## Deploying Updates

Whenever you push new code:

```bash
# On EC2
cd todo-app
git pull
npm run build   # if frontend changed
pm2 restart todo
```

---

## Cost Estimate (Free Tier)

| Service | Free Tier | After Free Tier |
|---|---|---|
| EC2 t2.micro | 750 hrs/month free (1yr) | ~$8.50/month |
| RDS db.t3.micro | 750 hrs/month free (1yr) | ~$15/month |
| Data transfer | 1 GB/month free | minimal |

Total: **$0 for the first year**, ~$25/month after.

---

## Troubleshooting

**Can't connect to RDS:**
- Check the RDS security group allows port 5432 from the EC2 security group
- Make sure `DB_SSL=true` is set in .env

**App not loading:**
- `pm2 logs todo` — check for errors
- Make sure EC2 security group has port 3001 (or 80) open

**Build failed on EC2:**
- EC2 t2.micro has limited RAM. If `npm run build` crashes, run it locally and `scp` the build folder up instead.
