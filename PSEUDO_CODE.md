# MSU Academic Mentorship Portal - Pseudo Code

## Table of Contents
1. System Overview
2. User Authentication
3. User Management
4. Session Management
5. Module Management
6. Matching System
7. Gamification System
8. Email Notifications
9. Data Structures

---

## 1. System Overview

```
SYSTEM: MSU Academic Mentorship Portal
ACTORS: Mentee, Mentor, Admin
DATABASE: PostgreSQL
FRONTEND: React
BACKEND: Node.js/Express

MAIN COMPONENTS:
    - Authentication System
    - User Management
    - Session Booking
    - Module Management
    - Mentor-Mentee Matching
    - Gamification (Badges, Reputation)
    - Virtual Meeting Room
    - Email Notifications
```

---

## 2. User Authentication

### 2.1 User Registration

```
FUNCTION registerUser(userData):
    INPUT: userData {
        student_id: STRING,
        email: STRING,
        password: STRING,
        first_name: STRING,
        last_name: STRING,
        user_type: ENUM('mentee', 'mentor', 'admin'),
        faculty: STRING,
        campus: STRING,
        phone: STRING,
        student_level: INTEGER (1-4),
        year_of_study: INTEGER (1-4)
    }
    
    // Validate input
    IF student_id NOT valid_format THEN
        RETURN error("Invalid student ID format")
    END IF
    
    IF email NOT valid_format THEN
        RETURN error("Invalid email format")
    END IF
    
    IF password NOT strong THEN
        RETURN error("Password must be at least 8 characters")
    END IF
    
    // Check if user already exists
    IF user_exists(student_id) OR user_exists(email) THEN
        RETURN error("User already exists")
    END IF
    
    // Hash password
    hashed_password = bcrypt_hash(password, salt=10)
    
    // Create user in database
    new_user = CREATE user WITH {
        id: generate_uuid(),
        student_id: userData.student_id,
        email: userData.email,
        password_hash: hashed_password,
        first_name: userData.first_name,
        last_name: userData.last_name,
        user_type: userData.user_type,
        faculty: userData.faculty,
        campus: userData.campus,
        phone: userData.phone,
        student_level: userData.student_level,
        year_of_study: userData.year_of_study,
        msu_verified: FALSE,
        is_verified: FALSE,
        is_mentor_verified: FALSE,
        reputation_score: 0,
        total_sessions: 0,
        created_at: current_timestamp()
    }
    
    // Send welcome email
    send_registration_email(userData.email, userData.first_name, userData.last_name)
    
    // Generate JWT token
    token = generate_jwt_token(new_user.id, new_user.user_type)
    
    RETURN success(token, new_user)
END FUNCTION
```

### 2.2 User Login

```
FUNCTION loginUser(email, password, selectedRole):
    // Find user by email
    user = GET user WHERE email = email
    
    IF user NOT found THEN
        RETURN error("Invalid credentials")
    END IF
    
    // Verify password
    IF NOT bcrypt_verify(password, user.password_hash) THEN
        RETURN error("Invalid credentials")
    END IF
    
    // Check role match
    IF selectedRole NOT EQUAL user.user_type THEN
        RETURN error("Role mismatch")
    END IF
    
    // Update last login
    UPDATE user SET last_login = current_timestamp()
    
    // Generate JWT token
    token = generate_jwt_token(user.id, user.user_type)
    
    RETURN success(token, user)
END FUNCTION
```

### 2.3 User Logout

```
FUNCTION logoutUser():
    // Clear token from localStorage
    localStorage.removeItem('token')
    
    // Clear axios headers
    DELETE axios.defaults.headers.common.Authorization
    
    // Clear user state
    SET user = NULL
    SET token = NULL
    
    RETURN success()
END FUNCTION
```

---

## 3. User Management

### 3.1 Get User Profile

```
FUNCTION getUserProfile(userId):
    user = GET user WHERE id = userId
    
    IF user NOT found THEN
        RETURN error("User not found")
    END IF
    
    // Remove sensitive data
    user.password_hash = NULL
    
    RETURN success(user)
END FUNCTION
```

### 3.2 Update User Profile

```
FUNCTION updateUserProfile(userId, updateData):
    user = GET user WHERE id = userId
    
    IF user NOT found THEN
        RETURN error("User not found")
    END IF
    
    // Update allowed fields
    ALLOWED_FIELDS = ['first_name', 'last_name', 'faculty', 'campus', 'phone']
    
    FOR EACH field IN updateData:
        IF field IN ALLOWED_FIELDS THEN
            UPDATE user SET field = updateData[field]
        END IF
    END FOR
    
    UPDATE user SET updated_at = current_timestamp()
    
    RETURN success(user)
END FUNCTION
```

### 3.3 Verify Mentor

```
FUNCTION verifyMentor(userId):
    user = GET user WHERE id = userId
    
    IF user.user_type NOT EQUAL 'mentor' THEN
        RETURN error("User is not a mentor")
    END IF
    
    UPDATE user SET is_mentor_verified = TRUE
    
    // Send verification email
    send_mentor_verification_email(user.email)
    
    RETURN success(user)
END FUNCTION
```

---

## 4. Session Management

### 4.1 Create Session (Book Session)

```
FUNCTION createSession(menteeId, sessionData):
    INPUT: sessionData {
        mentor_id: UUID,
        module_id: UUID,
        session_title: STRING,
        description: STRING,
        scheduled_date: TIMESTAMP,
        duration: INTEGER (minutes)
    }
    
    // Verify mentor exists and is verified
    mentor = GET user WHERE id = sessionData.mentor_id
    
    IF mentor NOT found OR mentor.is_mentor_verified = FALSE THEN
        RETURN error("Mentor not available")
    END IF
    
    // Check for scheduling conflicts
    IF has_conflict(mentor.id, sessionData.scheduled_date) THEN
        RETURN error("Mentor is not available at this time")
    END IF
    
    // Create session
    new_session = CREATE session WITH {
        id: generate_uuid(),
        mentee_id: menteeId,
        mentor_id: sessionData.mentor_id,
        module_id: sessionData.module_id,
        session_title: sessionData.session_title,
        description: sessionData.description,
        scheduled_date: sessionData.scheduled_date,
        duration: sessionData.duration,
        status: 'pending',
        meeting_link: NULL,
        created_at: current_timestamp()
    }
    
    // Send email notification to mentor
    mentor_details = GET user WHERE id = sessionData.mentor_id
    mentee_details = GET user WHERE id = menteeId
    module_details = GET module WHERE id = sessionData.module_id
    
    send_session_booking_email(
        mentor_details.email,
        mentor_details.first_name,
        mentee_details.first_name + " " + mentee_details.last_name,
        module_details.module_code,
        sessionData.session_title,
        sessionData.scheduled_date
    )
    
    RETURN success(new_session)
END FUNCTION
```

### 4.2 Accept/Decline Session

```
FUNCTION updateSessionStatus(sessionId, action):
    session = GET session WHERE id = sessionId
    
    IF session NOT found THEN
        RETURN error("Session not found")
    END IF
    
    IF action = 'accept' THEN
        UPDATE session SET status = 'accepted'
        
        // Generate meeting link
        meeting_link = generate_meeting_link(sessionId)
        UPDATE session SET meeting_link = meeting_link
        
    ELSE IF action = 'decline' THEN
        UPDATE session SET status = 'declined'
        
        // Notify mentee
        send_session_declined_email(session.mentee_id)
        
    ELSE IF action = 'cancel' THEN
        UPDATE session SET status = 'cancelled'
        
        // Notify both parties
        send_session_cancelled_email(session.mentee_id)
        send_session_cancelled_email(session.mentor_id)
        
    END IF
    
    RETURN success(session)
END FUNCTION
```

### 4.3 Start Session

```
FUNCTION startSession(sessionId):
    session = GET session WHERE id = sessionId
    
    IF session NOT found THEN
        RETURN error("Session not found")
    END IF
    
    IF session.status NOT EQUAL 'accepted' THEN
        RETURN error("Session cannot be started")
    END IF
    
    UPDATE session SET status = 'in_progress'
    
    // Send email notification to mentee
    mentee = GET user WHERE id = session.mentee_id
    mentor = GET user WHERE id = session.mentor_id
    module = GET module WHERE id = session.module_id
    
    send_session_started_email(
        mentee.email,
        mentee.first_name,
        mentor.first_name + " " + mentor.last_name,
        module.module_code,
        session.session_title,
        session.meeting_link
    )
    
    // Emit socket event
    socket.emit('session-started', { session_id: sessionId })
    
    RETURN success(session)
END FUNCTION
```

### 4.4 Complete Session

```
FUNCTION completeSession(sessionId, feedbackData):
    session = GET session WHERE id = sessionId
    
    IF session NOT found THEN
        RETURN error("Session not found")
    END IF
    
    UPDATE session SET status = 'completed'
    
    // Create feedback record
    CREATE feedback WITH {
        id: generate_uuid(),
        session_id: sessionId,
        from_user_id: feedbackData.from_user_id,
        to_user_id: feedbackData.to_user_id,
        rating: feedbackData.rating (1-5),
        comments: feedbackData.comments,
        created_at: current_timestamp()
    }
    
    // Update mentor reputation
    mentor = GET user WHERE id = session.mentor_id
    UPDATE mentor SET reputation_score = mentor.reputation_score + feedbackData.rating
    UPDATE mentor SET total_sessions = mentor.total_sessions + 1
    
    // Check for badge awards
    check_badge_eligibility(mentor.id)
    
    RETURN success(session)
END FUNCTION
```

### 4.5 Get User Sessions

```
FUNCTION getUserSessions(userId, role):
    IF role = 'mentee' THEN
        sessions = GET sessions WHERE mentee_id = userId
    ELSE IF role = 'mentor' THEN
        sessions = GET sessions WHERE mentor_id = userId
    END IF
    
    // Sort by scheduled date (descending)
    sessions = SORT sessions BY scheduled_date DESC
    
    RETURN success(sessions)
END FUNCTION
```

---

## 5. Module Management

### 5.1 Get All Modules

```
FUNCTION getAllModules():
    modules = GET modules ORDER BY module_code ASC
    
    RETURN success(modules)
END FUNCTION
```

### 5.2 Get Module by ID

```
FUNCTION getModuleById(moduleId):
    module = GET module WHERE id = moduleId
    
    IF module NOT found THEN
        RETURN error("Module not found")
    END IF
    
    RETURN success(module)
END FUNCTION
```

### 5.3 Add User Module

```
FUNCTION addUserModule(userId, moduleId):
    // Check if already added
    IF user_module_exists(userId, moduleId) THEN
        RETURN error("Module already added")
    END IF
    
    CREATE user_module WITH {
        id: generate_uuid(),
        user_id: userId,
        module_id: moduleId,
        added_at: current_timestamp()
    }
    
    RETURN success()
END FUNCTION
```

---

## 6. Matching System

### 6.1 Find Available Mentors

```
FUNCTION findMentors(filters):
    INPUT: filters {
        module_id: UUID (optional),
        faculty: STRING (optional),
        campus: STRING (optional)
    }
    
    // Base query: Get all verified mentors
    mentors = GET users WHERE 
        user_type = 'mentor' AND 
        is_mentor_verified = TRUE
    
    // Apply filters
    IF filters.module_id IS NOT NULL THEN
        mentors = FILTER mentors WHERE teaches_module(filters.module_id)
    END IF
    
    IF filters.faculty IS NOT NULL THEN
        mentors = FILTER mentors WHERE faculty = filters.faculty
    END IF
    
    IF filters.campus IS NOT NULL THEN
        mentors = FILTER mentors WHERE campus = filters.campus
    END IF
    
    // Sort by reputation score (descending)
    mentors = SORT mentors BY reputation_score DESC
    
    RETURN success(mentors)
END FUNCTION
```

### 6.2 Get Mentor Availability

```
FUNCTION getMentorAvailability(mentorId, date):
    // Get all sessions for the mentor on the given date
    sessions = GET sessions WHERE 
        mentor_id = mentorId AND 
        scheduled_date BETWEEN date_start AND date_end AND
        status IN ('accepted', 'in_progress')
    
    // Calculate available time slots
    available_slots = calculate_available_slots(sessions, date)
    
    RETURN success(available_slots)
END FUNCTION
```

---

## 7. Gamification System

### 7.1 Award Badge

```
FUNCTION awardBadge(userId, badgeId):
    // Check if user already has this badge
    IF user_has_badge(userId, badgeId) THEN
        RETURN error("Badge already awarded")
    END IF
    
    CREATE user_badge WITH {
        id: generate_uuid(),
        user_id: userId,
        badge_id: badgeId,
        awarded_at: current_timestamp()
    }
    
    // Send notification
    send_badge_awarded_notification(userId, badgeId)
    
    RETURN success()
END FUNCTION
```

### 7.2 Check Badge Eligibility

```
FUNCTION check_badge_eligibility(userId):
    user = GET user WHERE id = userId
    badges = GET badges
    
    FOR EACH badge IN badges:
        IF badge_eligible(user, badge) THEN
            awardBadge(userId, badge.id)
        END IF
    END FOR
END FUNCTION

FUNCTION badge_eligible(user, badge):
    // First Session Badge
    IF badge.name = 'First Session' AND user.total_sessions >= 1 THEN
        RETURN TRUE
    END IF
    
    // Rising Star Badge
    IF badge.name = 'Rising Star' AND user.reputation_score >= 50 THEN
        RETURN TRUE
    END IF
    
    // Expert Mentor Badge
    IF badge.name = 'Expert Mentor' AND user.total_sessions >= 10 THEN
        RETURN TRUE
    END IF
    
    // Top Rated Badge
    IF badge.name = 'Top Rated' AND user.reputation_score >= 100 THEN
        RETURN TRUE
    END IF
    
    RETURN FALSE
END FUNCTION
```

### 7.3 Get User Badges

```
FUNCTION getUserBadges(userId):
    user_badges = GET user_badges WHERE user_id = userId
    
    badges = []
    FOR EACH user_badge IN user_badges:
        badge = GET badge WHERE id = user_badge.badge_id
        badges.append(badge)
    END FOR
    
    RETURN success(badges)
END FUNCTION
```

### 7.4 Get Leaderboard

```
FUNCTION getLeaderboard(limit = 10):
    // Get top mentors by reputation score
    mentors = GET users WHERE 
        user_type = 'mentor' AND 
        is_mentor_verified = TRUE
    ORDER BY reputation_score DESC
    LIMIT limit
    
    leaderboard = []
    FOR EACH mentor IN mentors:
        leaderboard.append({
            rank: current_index + 1,
            mentor_id: mentor.id,
            name: mentor.first_name + " " + mentor.last_name,
            reputation_score: mentor.reputation_score,
            total_sessions: mentor.total_sessions
        })
    END FOR
    
    RETURN success(leaderboard)
END FUNCTION
```

---

## 8. Email Notifications

### 8.1 Send Registration Email

```
FUNCTION send_registration_email(email, firstName, lastName):
    email_content = {
        to: email,
        subject: "Welcome to MSU Academic Mentorship Portal",
        body: generate_welcome_email_template(firstName, lastName)
    }
    
    send_email(email_content)
END FUNCTION
```

### 8.2 Send Session Booking Email to Mentor

```
FUNCTION send_session_booking_email(mentorEmail, mentorName, menteeName, moduleCode, sessionTitle, scheduledDate):
    email_content = {
        to: mentorEmail,
        subject: "New Session Request: " + moduleCode,
        body: generate_booking_email_template(mentorName, menteeName, moduleCode, sessionTitle, scheduledDate)
    }
    
    send_email(email_content)
END FUNCTION
```

### 8.3 Send Session Started Email to Mentee

```
FUNCTION send_session_started_email(menteeEmail, menteeName, mentorName, moduleCode, sessionTitle, meetingLink):
    email_content = {
        to: menteeEmail,
        subject: "Your Session Has Started: " + moduleCode,
        body: generate_session_started_email_template(menteeName, mentorName, moduleCode, sessionTitle, meetingLink)
    }
    
    send_email(email_content)
END FUNCTION
```

---

## 9. Data Structures

### 9.1 User Table

```
TABLE users:
    id: UUID (PRIMARY KEY)
    student_id: VARCHAR(20) (UNIQUE)
    email: VARCHAR(255) (UNIQUE)
    password_hash: VARCHAR(255)
    first_name: VARCHAR(100)
    last_name: VARCHAR(100)
    user_type: ENUM('mentee', 'mentor', 'admin')
    faculty: VARCHAR(100)
    campus: VARCHAR(50)
    phone: VARCHAR(20)
    student_level: INTEGER (1-4)
    year_of_study: INTEGER (1-4)
    msu_verified: BOOLEAN
    is_verified: BOOLEAN
    is_mentor_verified: BOOLEAN
    reputation_score: INTEGER
    total_sessions: INTEGER
    created_at: TIMESTAMP
    updated_at: TIMESTAMP
    last_login: TIMESTAMP
    data_lite_mode: BOOLEAN
```

### 9.2 Session Table

```
TABLE mentorship_sessions:
    id: UUID (PRIMARY KEY)
    mentee_id: UUID (FOREIGN KEY → users.id)
    mentor_id: UUID (FOREIGN KEY → users.id)
    module_id: UUID (FOREIGN KEY → modules.id)
    session_title: VARCHAR(255)
    description: TEXT
    scheduled_date: TIMESTAMP
    duration: INTEGER (minutes)
    status: ENUM('pending', 'accepted', 'declined', 'cancelled', 'in_progress', 'completed')
    meeting_link: VARCHAR(255)
    created_at: TIMESTAMP
    updated_at: TIMESTAMP
```

### 9.3 Module Table

```
TABLE modules:
    id: UUID (PRIMARY KEY)
    module_code: VARCHAR(20) (UNIQUE)
    module_name: VARCHAR(255)
    faculty: VARCHAR(100)
    level: INTEGER (1-4)
    description: TEXT
```

### 9.4 Badge Table

```
TABLE badges:
    id: UUID (PRIMARY KEY)
    name: VARCHAR(100)
    description: TEXT
    icon_url: VARCHAR(255)
    requirement: TEXT
```

### 9.5 User Badge Table

```
TABLE user_badges:
    id: UUID (PRIMARY KEY)
    user_id: UUID (FOREIGN KEY → users.id)
    badge_id: UUID (FOREIGN KEY → badges.id)
    awarded_at: TIMESTAMP
```

### 9.6 Feedback Table

```
TABLE feedback:
    id: UUID (PRIMARY KEY)
    session_id: UUID (FOREIGN KEY → mentorship_sessions.id)
    from_user_id: UUID (FOREIGN KEY → users.id)
    to_user_id: UUID (FOREIGN KEY → users.id)
    rating: INTEGER (1-5)
    comments: TEXT
    created_at: TIMESTAMP
```

---

## 10. API Endpoints Summary

### Authentication
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me

### Users
- GET /api/users/:id
- PUT /api/users/:id
- GET /api/users/:id/badges

### Sessions
- POST /api/sessions
- GET /api/sessions
- GET /api/sessions/:id
- PUT /api/sessions/:id/status
- POST /api/sessions/:id/feedback

### Modules
- GET /api/modules
- GET /api/modules/:id
- POST /api/users/:userId/modules

### Matching
- GET /api/matching/mentors
- GET /api/matching/mentors/:mentorId/availability

### Gamification
- GET /api/gamification/badges
- GET /api/gamification/leaderboard

### Analytics
- GET /api/analytics/dashboard
- GET /api/analytics/sessions

---

## 11. Main Application Flow

```
MAIN APPLICATION FLOW:

1. User opens application
   → Check if token exists in localStorage
   → If yes, verify token and load user data
   → If no, redirect to login page

2. User registers/logs in
   → Validate credentials
   → Generate JWT token
   → Store token in localStorage
   → Redirect to dashboard

3. Dashboard (Mentee)
   → View available mentors
   → Filter by module, faculty, campus
   → Book session with mentor
   → View my sessions
   → View my badges

4. Dashboard (Mentor)
   → View session requests
   → Accept/decline sessions
   → Start sessions
   → View my sessions
   → View my badges
   → View leaderboard

5. Session Flow
   → Mentee books session
   → Mentor receives email notification
   → Mentor accepts session
   → Meeting link generated
   → Session starts
   → Mentee receives email notification
   → Session completes
   → Feedback submitted
   → Badges awarded
   → Reputation updated

6. Admin Dashboard
   → View all users
   → Verify mentors
   → View analytics
   → Manage system
```

---

## End of Pseudo Code Document
