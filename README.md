# MSU Academic Mentorship Portal (AMP)

A web-based peer-to-peer academic mentorship platform for Midlands State University that connects struggling students with verified high-performing peers through automated data-driven matching.

## 🎯 Features

### Core Functionalities
- **User Registration & Verification**: Student registration with role-based access (mentee/mentor/admin)
- **Automated Mentor-Mentee Matching**: Intelligent algorithm matching based on module codes, grades, and availability
- **Virtual Collaboration Workspace**: Real-time interactive rooms with shared whiteboards and code editors
- **Gamified Incentives**: Badge system, reputation scoring, and digital certificates for top mentors
- **Predictive Help Nudges**: Analytics engine that identifies struggling students and suggests help
- **Data-Lite Mode**: Low-bandwidth optimization for off-campus students with limited connectivity
- **Transcript Verification**: Secure file upload and verification system with automatic purging

### Key Algorithms
- **Automated Matching Algorithm**: Scores mentors based on reputation (40%), grade quality (30%), and availability (30%)
- **Smart Nudge Analytics Engine**: Analyzes search patterns to predict students needing help
- **Multi-layered Verification Engine**: Validates transcripts and automatically purges files after verification
- **Gamified Incentive Engine**: Calculates reputation scores and issues digital certificates

## 🏗️ Tech Stack

### Backend
- **Node.js** with Express.js
- **PostgreSQL** database
- **Socket.io** for real-time collaboration
- **JWT** for authentication
- **Multer** for file uploads
- **Bcrypt** for password hashing

### Frontend
- **React 18** with Vite
- **TailwindCSS** for styling
- **React Router** for navigation
- **Axios** for API calls
- **Socket.io-client** for real-time features
- **Monaco Editor** for code editing
- **Lucide React** for icons
- **React Hot Toast** for notifications

## 📋 Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## 🚀 Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd "MSU Academic Mentorship portal"
```

### 2. Install Dependencies
```bash
# Install all dependencies (root, server, and client)
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

### 3. Database Setup

#### Create PostgreSQL Database
```sql
CREATE DATABASE msu_mentorship_portal;
```

#### Run Schema
```bash
cd server
psql -U postgres -d msu_mentorship_portal -f database/schema.sql
```

### 4. Environment Configuration

Create a `.env` file in the `server` directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=msu_mentorship_portal
DB_USER=postgres
DB_PASSWORD=your_password

# JWT Secret
JWT_SECRET=your_jwt_secret_key_change_in_production
JWT_EXPIRE=7d

# File Upload Configuration
MAX_FILE_SIZE=5242880
UPLOAD_DIR=./uploads

# CORS Configuration
CLIENT_URL=http://localhost:5173
```

### 5. Run the Application

#### Development Mode (Both servers)
```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:5000`
- Frontend dev server on `http://localhost:5173`

#### Run Separately
```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd client
npm run dev
```

#### Production Build
```bash
# Build frontend
cd client
npm run build

# Start backend (serves built frontend)
cd ../server
npm start
```

## 📁 Project Structure

```
MSU Academic Mentorship portal/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── contexts/      # React contexts (Auth, DataLite)
│   │   ├── pages/         # Page components
│   │   ├── App.jsx        # Main app component
│   │   └── main.jsx       # Entry point
│   ├── public/            # Static assets
│   ├── index.html         # HTML template
│   ├── package.json       # Frontend dependencies
│   ├── vite.config.js     # Vite configuration
│   └── tailwind.config.js # TailwindCSS configuration
├── server/                # Node.js backend
│   ├── config/            # Configuration files
│   │   └── database.js    # PostgreSQL connection
│   ├── database/          # Database files
│   │   └── schema.sql     # Database schema
│   ├── middleware/        # Express middleware
│   │   ├── auth.js        # Authentication middleware
│   │   ├── dataLite.js   # Data-Lite middleware
│   │   └── errorHandler.js
│   ├── routes/            # API routes
│   │   ├── auth.js        # Authentication routes
│   │   ├── users.js       # User management
│   │   ├── modules.js     # Module management
│   │   ├── sessions.js    # Session management
│   │   ├── matching.js    # Matching algorithm
│   │   ├── gamification.js # Gamification system
│   │   ├── analytics.js   # Analytics & nudges
│   │   └── upload.js      # File uploads
│   ├── uploads/           # Upload directory (auto-created)
│   ├── index.js           # Server entry point
│   ├── .env.example       # Environment template
│   └── package.json       # Backend dependencies
├── package.json           # Root package.json
└── README.md             # This file
```

## 🔑 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/mentors` - Get all verified mentors
- `GET /api/users/:id` - Get user by ID

### Modules
- `GET /api/modules` - Get all modules
- `GET /api/modules/:id` - Get module by ID
- `POST /api/modules` - Create new module (admin)
- `POST /api/modules/user-modules` - Add module to user expertise
- `GET /api/modules/search` - Search modules

### Sessions
- `POST /api/sessions` - Create new session
- `GET /api/sessions` - Get user sessions
- `GET /api/sessions/:id` - Get session by ID
- `PUT /api/sessions/:id/status` - Update session status
- `POST /api/sessions/:id/join` - Join session
- `POST /api/sessions/:id/feedback` - Submit feedback

### Matching
- `POST /api/matching/find-mentor` - Find available mentors
- `POST /api/matching/auto-match` - Automatic mentor matching
- `GET /api/matching/recommendations` - Get personalized recommendations
- `GET /api/matching/availability/:mentor_id` - Check mentor availability

### Gamification
- `GET /api/gamification/badges` - Get all badges
- `GET /api/gamification/user-badges` - Get user badges
- `POST /api/gamification/check-badges` - Check and award badges
- `GET /api/gamification/leaderboard` - Get mentor leaderboard
- `GET /api/gamification/certificate/:user_id` - Generate certificate
- `GET /api/gamification/stats/:user_id` - Get user statistics

### Analytics
- `POST /api/analytics/track` - Track analytics event
- `GET /api/analytics/user-activity` - Get user activity
- `GET /api/analytics/module-demand` - Get module demand analytics
- `GET /api/analytics/predictive-nudges` - Get predictive nudges
- `POST /api/analytics/generate-nudges` - Generate predictive nudges
- `PUT /api/analytics/nudges/:id/dismiss` - Dismiss nudge
- `GET /api/analytics/dashboard` - Get admin dashboard analytics

### Upload
- `POST /api/upload/transcript` - Upload transcript
- `GET /api/upload/verification-status` - Get verification status
- `POST /api/upload/verify/:id` - Verify transcript (admin)
- `GET /api/upload/pending-verifications` - Get pending verifications (admin)

## 🎮 Gamification System

### Badges
- **First Session**: Complete your first mentorship session
- **Rising Star**: Complete 5 mentorship sessions
- **Expert Mentor**: Complete 20 mentorship sessions
- **Top Rated**: Maintain average rating of 4.5+
- **Helpful Hero**: Receive 10 positive feedback ratings
- **Consistent Helper**: Complete sessions in 5 different modules
- **Night Owl**: Complete sessions after 10 PM
- **Quick Responder**: Respond to session requests within 1 hour

### Reputation Scoring
- +10 points per session completed
- +2 points per rating star received
- Badge achievements add bonus points
- Negative feedback reduces reputation

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Bcrypt for secure password storage
- **Transcript Purging**: Automatic file deletion after verification
- **Rate Limiting**: API rate limiting to prevent abuse
- **CORS Protection**: Configured CORS for cross-origin requests
- **Helmet.js**: Security headers for Express
- **Input Validation**: Express-validator for request validation

## 📊 Data-Lite Mode

Optimized for low-bandwidth environments:
- Reduced data transfer with selective loading
- Caching headers for static content
- Simplified UI components
- Optional image/media loading
- Compressed API responses

## 🧪 Testing

### Run Tests
```bash
cd server
npm test
```

### Manual Testing Checklist
- [ ] User registration and login
- [ ] Mentor verification workflow
- [ ] Module search and matching
- [ ] Session creation and management
- [ ] Virtual room collaboration
- [ ] Badge awarding system
- [ ] Predictive nudges generation
- [ ] Admin dashboard functionality
- [ ] Data-Lite mode operation

## 🚀 Deployment

### Production Setup
1. Set `NODE_ENV=production` in `.env`
2. Use strong JWT secrets
3. Configure production database
4. Set up SSL certificates
5. Configure reverse proxy (nginx)
6. Set up process manager (PM2)
7. Configure backup strategy

### Environment Variables
```env
NODE_ENV=production
PORT=5000
DB_HOST=production-db-host
DB_NAME=msu_mentorship_portal
DB_USER=production_user
DB_PASSWORD=strong_password
JWT_SECRET=very_strong_random_secret
CLIENT_URL=https://your-domain.com
```

## 📈 Monitoring & Analytics

The system includes built-in analytics for:
- User activity tracking
- Module demand analysis
- Session completion rates
- Mentor performance metrics
- System usage patterns

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 👥 Team

MSU Development Team
- Midlands State University

## 📞 Support

For support and queries:
- Email: support@msu.ac.zw
- Documentation: See project wiki

## 🎯 Future Enhancements

- Mobile application (React Native)
- Advanced whiteboard features
- Video conferencing integration
- AI-powered matching improvements
- Expanded analytics dashboard
- Multi-language support
- Integration with university LMS (Moodle)

---

**Version**: 1.0.0  
**Last Updated**: September 2026  
**Status**: Production Ready
