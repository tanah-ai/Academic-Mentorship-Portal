# MSU Academic Mentorship Portal - Complete Setup Guide

## 🎯 Overview
This guide will help you set up and run the MSU Academic Mentorship Portal for Midlands State University students. The system achieves all 5 core objectives:

1. ✅ **User Registration and Verification** - MSU-specific validation and transcript verification
2. ✅ **Automated Mentor-Mentee Pairing** - Smart matching algorithm based on grades and reputation
3. ✅ **Interactive Virtual Workspace** - Real-time whiteboard, code editor, and chat
4. ✅ **Session Tracking and Gamified Incentives** - Badges, reputation scores, certificates
5. ✅ **Predictive Help Nudges** - Analytics engine to identify struggling students

## 📋 Prerequisites

### Required Software
- **Node.js** (v16 or higher) - Download from https://nodejs.org/
- **PostgreSQL** (v12 or higher) - Download from https://www.postgresql.org/download/windows/
- **Git** (optional) - For version control

### System Requirements
- Windows 10/11, macOS, or Linux
- 4GB RAM minimum (8GB recommended)
- 10GB free disk space
- Internet connection for development

## 🚀 Installation Steps

### Step 1: Install PostgreSQL

#### Windows:
1. Download PostgreSQL installer from https://www.postgresql.org/download/windows/
2. Run the installer and follow the setup wizard
3. Remember the password you set for the `postgres` user
4. Ensure PostgreSQL service is running (check in Services)

#### Verify Installation:
```bash
# Open Command Prompt/PowerShell
psql --version
```

### Step 2: Set Up Database

#### Create Database:
```bash
# Open SQL Shell (psql) from PostgreSQL installation
# Login with your postgres password
psql -U postgres

# Create the database
CREATE DATABASE msu_mentorship_portal;

# Exit
\q
```

#### Run Database Schema:
```bash
# Navigate to project directory
cd "C:\Users\User\Desktop\MSU Academic Mentorship portal\server\database"

# Run the schema file
psql -U postgres -d msu_mentorship_portal -f schema.sql
```

### Step 3: Configure Environment Variables

#### Backend Configuration:
```bash
cd "C:\Users\User\Desktop\MSU Academic Mentorship portal\server"
```

Edit the `.env` file with your database credentials:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=msu_mentorship_portal
DB_USER=postgres
DB_PASSWORD=your_postgres_password_here

# JWT Secret (generate a secure random string)
JWT_SECRET=msu_mentorship_secret_key_2024_secure_random_string
JWT_EXPIRE=7d

# File Upload Configuration
MAX_FILE_SIZE=5242880
UPLOAD_DIR=./uploads

# CORS Configuration
CLIENT_URL=http://localhost:5173
```

### Step 4: Install Dependencies

#### Install All Dependencies:
```bash
cd "C:\Users\User\Desktop\MSU Academic Mentorship portal"
npm run install-all
```

Or install separately:
```bash
# Root dependencies
npm install

# Server dependencies
cd server
npm install

# Client dependencies
cd ../client
npm install
```

### Step 5: Start the Application

#### Development Mode (Both servers):
```bash
cd "C:\Users\User\Desktop\MSU Academic Mentorship portal"
npm run dev
```

This will start:
- **Backend server** on `http://localhost:5000`
- **Frontend dev server** on `http://localhost:5173`

#### Run Separately (if needed):
```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd client
npm run dev
```

### Step 6: Access the Application

Open your browser and navigate to: `http://localhost:5173`

## 👤 Initial User Setup

### Create Admin User

1. **Register a new user** at `http://localhost:5173/register`
2. **Manually set user to admin** in database:

```bash
psql -U postgres -d msu_mentorship_portal
```

```sql
-- Update user to admin role
UPDATE users SET user_type = 'admin' WHERE email = 'your_admin_email@students.msu.ac.zw';
```

### Create Sample MSU Modules

```sql
-- Insert sample MSU modules
INSERT INTO modules (module_code, module_name, faculty, level, semester, credits, description) VALUES
('CS101', 'Introduction to Computer Science', 'Science and Technology', 1, 'Semester 1', 4, 'Fundamental concepts of computer science'),
('CS201', 'Data Structures and Algorithms', 'Science and Technology', 2, 'Semester 1', 4, 'Advanced data structures and algorithm analysis'),
('CS301', 'Database Systems', 'Science and Technology', 3, 'Semester 2', 4, 'Database design and management'),
('CS401', 'Software Engineering', 'Science and Technology', 4, 'Semester 1', 4, 'Software development methodologies'),
('ACC101', 'Financial Accounting', 'Business Sciences', 1, 'Semester 1', 4, 'Basic accounting principles'),
('ECON201', 'Microeconomics', 'Business Sciences', 2, 'Semester 1', 4, 'Microeconomic theory and applications'),
('MATH101', 'Calculus I', 'Science and Technology', 1, 'Semester 1', 4, 'Introduction to calculus'),
('MATH201', 'Linear Algebra', 'Science and Technology', 2, 'Semester 2', 4, 'Matrix theory and linear transformations');
```

### Insert Sample Badges

```sql
-- Insert gamification badges
INSERT INTO badges (name, description, icon, points, requirement_type, requirement_value) VALUES
('First Session', 'Complete your first mentorship session', '🎯', 10, 'sessions_completed', 1),
('Rising Star', 'Complete 5 mentorship sessions', '⭐', 50, 'sessions_completed', 5),
('Expert Mentor', 'Complete 20 mentorship sessions', '🏆', 200, 'sessions_completed', 20),
('Top Rated', 'Maintain average rating of 4.5+', '💎', 100, 'rating_average', 4.5),
('Helpful Hero', 'Receive 10 positive feedback ratings', '🦸', 75, 'positive_feedback', 10),
('Consistent Helper', 'Complete sessions in 5 different modules', '📚', 80, 'modules_variety', 5),
('Night Owl', 'Complete sessions after 10 PM', '🦉', 30, 'late_sessions', 3),
('Quick Responder', 'Respond to session requests within 1 hour', '⚡', 40, 'quick_response', 1);
```

## 🎓 MSU Student Registration Guide

### For Mentees (Students seeking help):

1. **Navigate to Registration**: `http://localhost:5173/register`
2. **Fill in MSU Student Details**:
   - **Student ID**: Format `RYYNNNNA` (e.g., R234567A)
   - **Email**: Must be `@students.msu.ac.zw`
   - **Password**: Minimum 6 characters
   - **Name**: First and last name
   - **User Type**: Select "Mentee"
   - **Student Level**: 1-4 (1 = First year)
   - **Faculty**: Your faculty (e.g., Science and Technology)
   - **Campus**: Main Campus or others

3. **Complete Registration**: You'll receive a JWT token for authentication

### For Mentors (Students providing help):

1. **Register as above**, but select "Mentor" as user type
2. **Must be Level 2 or above** to qualify as mentor
3. **Upload Transcript**:
   - Go to Profile page
   - Upload academic transcript (PDF/Word)
   - Wait for admin verification

4. **MSU Mentor Requirements**:
   - **Student Level**: 2 or above
   - **Academic Performance**: 
     - At least 6 Distinctions (A, D)
     - At least 6 2.1 grades (First Class)
     - At least 1 2.2 grade (Second Class)
     - No 3 (Fail) grades

5. **Admin Verification Process**:
   - Admin reviews uploaded transcript
   - System validates grade requirements
   - Upon approval, mentor status is activated
   - Transcript file is automatically purged for security

## 🔧 Testing Each Objective

### 1. User Registration and Verification ✅

**Test Steps**:
1. Register as mentee with valid MSU credentials
2. Register as mentor with Level 2+ status
3. Upload transcript as mentor
4. Login as admin and verify transcript
5. Check mentor verification status

**Expected Results**:
- MSU student ID validation works
- Email domain validation works
- Mentor eligibility criteria enforced
- Transcript upload and verification successful
- File purging after verification

### 2. Automated Mentor-Mentee Pairing ✅

**Test Steps**:
1. Create sample modules in database
2. Register mentors with different grades and reputations
3. As mentee, go to "Find Mentor" page
4. Search for mentors by module
5. Use "Auto Match" feature
6. Check mentor recommendations

**Expected Results**:
- Matching algorithm considers reputation (40%), grades (30%), availability (30%)
- Higher reputation mentors appear first
- MSU grading system properly weighted
- Faculty/campus filtering works
- Auto-match selects best available mentor

### 3. Interactive Virtual Workspace ✅

**Test Steps**:
1. Book a mentorship session
2. Join the virtual room at scheduled time
3. Test whiteboard drawing tools
4. Test code editor collaboration
5. Test chat functionality
6. Test video/audio controls

**Expected Results**:
- Whiteboard: Drawing, shapes, text, colors, clear, download
- Code Editor: Real-time collaboration, syntax highlighting
- Chat: Real-time messaging, user identification
- Video/Audio: Toggle controls (UI present)
- Real-time sync via Socket.io

### 4. Session Tracking and Gamified Incentives ✅

**Test Steps**:
1. Complete a mentorship session
2. Submit feedback for mentor
3. Check badge achievements
4. View leaderboard
5. Generate mentor certificate

**Expected Results**:
- Session status updates correctly
- Feedback submission updates reputation
- Badges awarded based on achievements
- Leaderboard shows top mentors
- Certificate generation works
- Gamification stats accurate

### 5. Predictive Help Nudges ✅

**Test Steps**:
1. As mentee, search for mentors frequently without booking
2. Trigger nudge generation (or use admin endpoint)
3. Check for help nudges in dashboard
4. Dismiss or act on nudges
5. View analytics dashboard

**Expected Results**:
- System identifies struggling students
- Help nudges generated and displayed
- High-demand modules identified
- Analytics dashboard shows activity
- Nudge dismissal works

## 🛠️ Troubleshooting

### Database Connection Issues

**Problem**: "Connection refused" or database errors

**Solutions**:
```bash
# Check PostgreSQL service is running
# Windows: Services > PostgreSQL
# Check connection
psql -U postgres -d msu_mentorship_portal

# Check .env file credentials
# Ensure DB_PASSWORD matches your PostgreSQL password
```

### Port Already in Use

**Problem**: "Port 5000 already in use"

**Solutions**:
```bash
# Find process using port 5000 (Windows)
netstat -ano | findstr :5000

# Kill process or change PORT in .env
PORT=5001
```

### Module Not Found Errors

**Problem**: "Module not found" errors

**Solutions**:
```bash
# Reinstall dependencies
cd server && npm install
cd ../client && npm install

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### CORS Errors

**Problem**: CORS errors in browser console

**Solutions**:
- Ensure CLIENT_URL in `.env` matches your frontend URL
- Check backend CORS configuration in `server/index.js`
- Verify both servers are running

### Socket.io Connection Issues

**Problem**: Real-time features not working

**Solutions**:
- Check both frontend and backend are running
- Verify Socket.io client is connected (check browser console)
- Ensure socket event names match between client and server

## 📊 Admin Dashboard Features

### User Management
- View all registered users
- Filter by user type (mentee/mentor/admin)
- View verification status
- Manage user permissions

### Transcript Verification
- View pending transcript uploads
- Review student academic records
- Approve/reject based on MSU criteria
- Automatic file purging after verification

### Analytics Dashboard
- Total users and sessions
- Module demand analysis
- User activity tracking
- System performance metrics

### Generate Help Nudges
- Manual nudge generation
- View struggling students
- High-demand module alerts
- Predictive analytics

## 🔒 Security Features

### Implemented Security Measures
- ✅ JWT token-based authentication
- ✅ Bcrypt password hashing
- ✅ Automatic transcript file purging
- ✅ API rate limiting
- ✅ CORS protection
- ✅ Helmet.js security headers
- ✅ Input validation with express-validator
- ✅ MSU-specific validation rules

### Security Best Practices
- Change default JWT secret in production
- Use strong database passwords
- Enable HTTPS in production
- Regular security updates
- Monitor for suspicious activity
- Implement backup strategy

## 📈 Performance Optimization

### Database Optimization
- Add indexes for frequently queried columns
- Use connection pooling
- Optimize slow queries
- Regular database maintenance

### Application Optimization
- Enable gzip compression
- Implement caching strategy
- Optimize asset loading
- Use CDN for static assets (production)
- Monitor performance metrics

## 🚀 Production Deployment

### Build for Production
```bash
# Build frontend
cd client
npm run build

# Set production environment
cd ../server
cp .env.example .env.production
# Edit .env.production with production values
```

### Deploy to Production Server
1. Set up production database
2. Configure environment variables
3. Build and deploy frontend
4. Start backend with process manager (PM2)
5. Configure reverse proxy (nginx)
6. Set up SSL certificate
7. Configure firewall rules
8. Set up monitoring and backups

## 📞 Support and Resources

### Documentation
- Main README.md - Project overview
- SETUP_GUIDE.md - Technical setup details
- API Documentation - See code comments for endpoint details

### Common Issues
- Database connection problems
- Environment configuration
- Dependency installation
- Port conflicts
- CORS issues

### Getting Help
- Check troubleshooting section
- Review error messages carefully
- Verify all prerequisites are met
- Check database schema is properly loaded
- Ensure environment variables are correct

## 🎯 Success Criteria

Your MSU Academic Mentorship Portal is successfully set up when:

1. ✅ **Database**: PostgreSQL running with schema loaded
2. ✅ **Backend**: Node.js server running on port 5000
3. ✅ **Frontend**: React app running on port 5173
4. ✅ **Registration**: MSU students can register with validation
5. ✅ **Verification**: Mentor transcript upload and verification works
6. ✅ **Matching**: Automated mentor-mentee pairing functional
7. ✅ **Virtual Room**: Whiteboard, code editor, and chat working
8. ✅ **Gamification**: Badges, reputation, and certificates functional
9. ✅ **Analytics**: Predictive nudges and dashboard working
10. ✅ **Real-time**: Socket.io collaboration features operational

---

**Version**: 1.0  
**Last Updated**: September 2026  
**Institution**: Midlands State University  
**System**: MSU Academic Mentorship Portal