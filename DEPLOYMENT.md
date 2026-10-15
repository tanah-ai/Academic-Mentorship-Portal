# MSU Academic Mentorship Portal - Deployment Guide

This guide will help you deploy the MSU Academic Mentorship Portal to the cloud using free hosting services.

## Prerequisites

- GitHub account
- Render account (for backend)
- Vercel account (for frontend)
- PostgreSQL database (Render provides free PostgreSQL)

## Deployment Architecture

- **Frontend (React)**: Vercel
- **Backend (Node.js/Express)**: Render
- **Database (PostgreSQL)**: Render PostgreSQL

---

## Step 1: Deploy Backend to Render

### 1.1 Create PostgreSQL Database on Render

1. Go to [render.com](https://render.com) and sign up
2. Click "New" → "PostgreSQL"
3. Name: `msu-mentorship-db`
4. Region: Choose closest to you
5. Database: `msu_mentorship_portal`
6. User: `postgres`
7. Click "Create Database"
8. Save the **Internal Database URL** (you'll need it later)

### 1.2 Run Database Schema on Render

1. Go to your PostgreSQL database on Render
2. Click "Connect" → "External Connection"
3. Use a PostgreSQL client (like pgAdmin, DBeaver, or TablePlus) to connect
4. Run the SQL file: `server/database/schema.sql`
5. Run the SQL file: `server/database/bulk_insert_modules.sql`
6. Run the SQL file: `server/database/insert_default_badges.sql`

### 1.3 Deploy Backend to Render

1. Push your code to GitHub (if not already done)
2. Go to Render → "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `msu-mentorship-api`
   - **Region**: Same as database
   - **Branch**: `main`
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
5. Add Environment Variables (from `server/.env.example`):
   - `PORT`: `5000`
   - `NODE_ENV`: `production`
   - `DB_HOST`: (from your PostgreSQL Internal Database URL)
   - `DB_PORT`: `5432`
   - `DB_NAME`: `msu_mentorship_portal`
   - `DB_USER`: (from PostgreSQL connection details)
   - `DB_PASSWORD`: (from PostgreSQL connection details)
   - `JWT_SECRET`: (generate a strong random string)
   - `JWT_EXPIRE`: `7d`
   - `CLIENT_URL`: (your Vercel URL - add after deploying frontend)
   - `EMAIL_HOST`: `smtp.gmail.com` (or your email provider)
   - `EMAIL_PORT`: `587`
   - `EMAIL_USER`: your email
   - `EMAIL_PASSWORD`: your email app password
6. Click "Create Web Service"
7. Wait for deployment to complete
8. Save the **Service URL** (e.g., `https://msu-mentorship-api.onrender.com`)

---

## Step 2: Deploy Frontend to Vercel

### 2.1 Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. Add Environment Variables:
   - `VITE_API_URL`: (your Render backend URL, e.g., `https://msu-mentorship-api.onrender.com`)
6. Click "Deploy"
7. Wait for deployment to complete
8. Save the **Vercel URL** (e.g., `https://msu-mentorship.vercel.app`)

---

## Step 3: Update Backend CORS

1. Go to your Render backend service
2. Click "Environment" tab
3. Update `CLIENT_URL` to your Vercel URL
4. Click "Save Changes"
5. The service will automatically redeploy

---

## Step 4: Test Your Deployed Application

1. Open your Vercel URL in a browser
2. Try registering a new user
3. Try logging in
4. Test all features

---

## Important Notes

### Database Migrations
If you make changes to the database schema:
1. Create a new SQL migration file in `server/database/`
2. Connect to Render PostgreSQL and run the migration

### Email Configuration
For email notifications to work:
- Use Gmail with App Password (recommended)
- Enable 2-factor authentication on your Google account
- Generate an App Password at Google Account → Security → App Passwords

### Free Tier Limits
- **Render**: Free tier has 512MB RAM, 0.1 CPU, sleeps after 15min inactivity
- **Vercel**: Free tier is generous for personal projects
- **PostgreSQL**: Free tier has 90-day limit (may need to redeploy periodically)

### Custom Domain (Optional)
To use a custom domain:
1. Buy a domain (e.g., from Namecheap, GoDaddy)
2. Add it to Vercel (Settings → Domains)
3. Add it to Render (Settings → Domains)
4. Update DNS records as instructed

---

## Troubleshooting

### Backend won't start
- Check Render logs for errors
- Ensure all environment variables are set
- Verify database connection details

### Frontend can't connect to backend
- Check `VITE_API_URL` in Vercel environment variables
- Ensure CORS is configured correctly in backend
- Check browser console for errors

### Database connection failed
- Verify PostgreSQL is running on Render
- Check database credentials in environment variables
- Ensure database schema is imported

---

## Updating Your Application

After making changes:
1. Commit and push to GitHub
2. Vercel will auto-deploy frontend
3. Render will auto-deploy backend (or click "Manual Deploy" if needed)
