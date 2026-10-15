# MSU Academic Mentorship Portal - Setup Guide

## Quick Start Guide

### 1. Database Setup

#### Install PostgreSQL
- Windows: Download from https://www.postgresql.org/download/windows/
- Mac: `brew install postgresql`
- Linux: `sudo apt-get install postgresql`

#### Create Database
```bash
# Start PostgreSQL service
# Windows: Start PostgreSQL service from Services
# Mac/Linux: sudo service postgresql start

# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE msu_mentorship_portal;

# Exit
\q
```

#### Run Schema
```bash
cd server/database
psql -U postgres -d msu_mentorship_portal -f schema.sql
```

### 2. Environment Configuration

Copy the example environment file:
```bash
cd server
cp .env.example .env
```

Edit `.env` with your settings:
```env
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=msu_mentorship_portal
DB_USER=postgres
DB_PASSWORD=your_postgres_password
JWT_SECRET=generate_a_secure_random_string_here
JWT_EXPIRE=7d
MAX_FILE_SIZE=5242880
UPLOAD_DIR=./uploads
CLIENT_URL=http://localhost:5173
```

### 3. Install Dependencies

```bash
# From project root
npm run install-all
```

Or manually:
```bash
npm install
cd server && npm install
cd ../client && npm install
```

### 4. Start Development Servers

```bash
# From project root
npm run dev
```

This starts:
- Backend: http://localhost:5000
- Frontend: http://localhost:5173

### 5. Access the Application

Open http://localhost:5173 in your browser.

## Initial User Setup

### Create Admin User
```bash
# Register a new user with admin role
# You'll need to manually set user_type to 'admin' in the database
```

```sql
-- After registration, update user to admin
UPDATE users SET user_type = 'admin' WHERE email = 'admin@example.com';
```

### Create Sample Modules
```sql
INSERT INTO modules (module_code, module_name, faculty, level, semester, credits, description) VALUES
('CS101', 'Introduction to Computer Science', 'Science and Technology', 1, 'Semester 1', 4, 'Fundamental concepts of computer science'),
('CS201', 'Data Structures and Algorithms', 'Science and Technology', 2, 'Semester 1', 4, 'Advanced data structures and algorithm analysis'),
('CS301', 'Database Systems', 'Science and Technology', 3, 'Semester 2', 4, 'Database design and management'),
('ACC101', 'Financial Accounting', 'Business Sciences', 1, 'Semester 1', 4, 'Basic accounting principles'),
('ECON201', 'Microeconomics', 'Business Sciences', 2, 'Semester 1', 4, 'Microeconomic theory and applications');
```

## Testing the Application

### 1. User Registration
- Navigate to http://localhost:5173/register
- Fill in registration details
- Choose user type (mentee or mentor)

### 2. Mentor Verification (if mentor)
- Go to Profile page
- Upload transcript
- Wait for admin approval

### 3. Admin Verification
- Login as admin
- Go to Admin Dashboard
- Review pending verifications
- Approve/reject transcripts

### 4. Find Mentor
- Go to Find Mentor page
- Select a module
- Search for mentors or use auto-match
- Book a session

### 5. Virtual Room
- Join a scheduled session
- Use whiteboard and code editor
- Chat with mentor/mentee
- End session when complete

## Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
# Windows: Check Services
# Mac/Linux: sudo service postgresql status

# Test connection
psql -U postgres -d msu_mentorship_portal
```

### Port Already in Use
```bash
# Find process using port 5000
# Windows: netstat -ano | findstr :5000
# Mac/Linux: lsof -i :5000

# Kill process or change PORT in .env
```

### Module Not Found Errors
```bash
# Ensure all dependencies are installed
cd server && npm install
cd ../client && npm install
```

### CORS Errors
- Ensure CLIENT_URL in .env matches your frontend URL
- Check backend CORS configuration in server/index.js

## Production Deployment

### 1. Build Frontend
```bash
cd client
npm run build
```

### 2. Configure Production Environment
```bash
cd server
cp .env.example .env.production
```

Edit `.env.production` with production values.

### 3. Set Up Process Manager (PM2)
```bash
npm install -g pm2
pm2 start server/index.js --name "amp-server"
pm2 save
pm2 startup
```

### 4. Configure Reverse Proxy (nginx)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5. Set Up SSL
```bash
# Use Let's Encrypt
sudo certbot --nginx -d your-domain.com
```

## Security Checklist

- [ ] Change default JWT secret
- [ ] Use strong database passwords
- [ ] Enable HTTPS in production
- [ ] Set up firewall rules
- [ ] Configure rate limiting
- [ ] Enable database backups
- [ ] Set up monitoring
- [ ] Review CORS settings
- [ ] Enable security headers
- [ ] Regular security updates

## Performance Optimization

### Database
- Add indexes for frequently queried columns
- Use connection pooling
- Optimize slow queries
- Regular database maintenance

### Application
- Enable gzip compression
- Implement caching strategy
- Optimize asset loading
- Use CDN for static assets
- Monitor performance metrics

## Backup Strategy

### Database Backups
```bash
# Manual backup
pg_dump -U postgres msu_mentorship_portal > backup.sql

# Automated backup (cron)
0 2 * * * pg_dump -U postgres msu_mentorship_portal > /backups/amp_$(date +\%Y\%m\%d).sql
```

### File Backups
- Backup uploaded transcripts regularly
- Backup configuration files
- Version control for code

## Monitoring

### Application Monitoring
- Use PM2 monitoring: `pm2 monit`
- Check logs: `pm2 logs amp-server`
- Monitor system resources

### Database Monitoring
- Monitor connection counts
- Track query performance
- Monitor disk space

## Support

For issues or questions:
- Check the main README.md
- Review API documentation
- Check troubleshooting section
- Contact development team

---

**Last Updated**: September 2026
