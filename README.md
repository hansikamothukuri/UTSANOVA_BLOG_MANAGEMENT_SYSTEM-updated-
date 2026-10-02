# Utsanova Blog Management System

> Complete, full-stack blog management platform for **UTSANOVA TECHNOLOGIES PVT. LTD.** featuring public blog discovery, search and keyword filtering, authenticated admin portal, Firebase Authentication, Firebase Admin SDK verification, and MySQL database management.

---

## 1. Project Overview

The **Utsanova Blog Management System** is an end-to-end web application built to serve two core audiences:
1. **Public Visitors & Learners**: Explore, search, and read published engineering blogs, student guides, and industry analyses. Drafts are strictly kept private.
2. **Authorized Administrators**: Authenticate securely using Firebase Authentication, view real-time blog analytics on the dashboard, create new articles (with optional AI drafting assistance), edit existing posts, update publication state (`Draft` vs `Published`), and safely delete articles.

---

## 2. Key Features

- **Public Blog Platform**:
  - Clean, responsive presentation of all `Published` blogs.
  - Full-text multi-field search (searches `title`, `content`, and `tags`).
  - Interactive tag filtering (`Technology`, `Education`, `Career`, `Students`, `React`, `Web Development`).
  - In-depth blog detail view with formatted typography, metadata, publication dates, and dedicated conclusion highlight boxes.
  - Zero exposure of draft articles to public routes or APIs.

- **Admin Portal & Security**:
  - Secure Email/Password authentication using Firebase Web SDK.
  - Backend token verification using Firebase Admin SDK (`Bearer <token>`).
  - Role-based authorization: checks Firebase UID against the MySQL `admins` table. Non-admin users are rejected with `403 Forbidden`.
  - Administrative dashboard displaying **Total Blogs**, **Published Blogs**, and **Draft Blogs**, plus recently modified articles.
  - Complete Blog CRUD (`Create`, `Read`, `Update`, `Delete`) with confirmation dialogs.
  - AI Blog Generator Assistant (powered by Google Gemini API) to automatically create structured drafts (Title, Content, Tags, Conclusion).

---

## 3. Technology Stack

### Frontend (`client/`)
- **React 19** with JSX and React Hooks
- **Vite** for fast modern frontend bundling
- **Tailwind CSS** for responsive styling
- **React Router 7** for public & protected route management
- **Firebase Web SDK** for client authentication
- **Axios** with request interceptors for Bearer token propagation
- **Lucide React** for icons

### Backend (`server/`)
- **Node.js** runtime
- **Express.js** REST API framework
- **Firebase Admin SDK** for backend JWT verification
- **mysql2/promise** for MySQL connection pooling and parameterized queries
- **dotenv** for environment configuration
- **CORS** middleware

### Database (`database/`)
- **MySQL** (`utsanova_blog`)
- Normalized schema with `admins` and `blogs` tables
- Status enum (`Draft`, `Published`), indexes, and timestamps

---

## 4. Architecture & Workflow

```
[ Visitor / Admin Browser ]
            │
            ├──── Public Pages: / , /blogs , /blogs/:id
            └──── Admin Portal: /admin/login , /admin/dashboard , /admin/blogs
                        │
                        ▼ (Firebase Auth)
              [ Firebase Web SDK ] ──► Returns Firebase ID Token
                        │
                        ▼ (Bearer Token in Headers)
              [ Express.js REST API ]
                        │
                        ▼ (authMiddleware)
              [ Firebase Admin SDK ] ──► Verifies Token & Extracts UID
                        │
                        ▼ (adminMiddleware)
              [ MySQL `admins` Table ] ──► Validates UID Authorization (403 if absent)
                        │
                        ▼ (blogController & blogService)
              [ MySQL `blogs` Table ] ──► Executes Parameterized SQL Queries
```

---

## 5. Fixed Project Structure

```
utsanova-blog-management-system/
├── client/
│   ├── src/
│   │   ├── components/       # UI components (BlogCard, SearchBar, Modals, Navbar, etc.)
│   │   ├── pages/
│   │   │   ├── public/       # HomePage, BlogsPage, BlogDetailPage
│   │   │   └── admin/        # AdminLoginPage, AdminDashboardPage, AdminBlogsPage, AdminBlogFormPage
│   │   ├── layouts/          # PublicLayout, AdminLayout
│   │   ├── services/         # api.js, blogService.js
│   │   ├── hooks/            # useAuth.jsx
│   │   ├── utils/            # formatDate.js
│   │   ├── firebase/         # config.js, auth.js
│   │   ├── App.jsx           # Master route registry
│   │   └── main.jsx          # React entrypoint
│   ├── package.json
│   └── .env.example
│
├── server/
│   ├── src/
│   │   ├── config/           # db.js (MySQL pool & fallback), firebase.js (Admin SDK)
│   │   ├── controllers/      # blogController.js, dashboardController.js
│   │   ├── middleware/       # authMiddleware.js, adminMiddleware.js, errorHandler.js
│   │   ├── routes/           # publicBlogRoutes.js, adminBlogRoutes.js, dashboardRoutes.js, aiRoutes.js
│   │   ├── services/         # blogService.js, adminService.js
│   │   ├── utils/            # apiResponse.js, validators.js
│   │   ├── app.js            # Express application setup
│   │   └── server.js         # Express HTTP listener (Port 5000)
│   ├── package.json
│   └── .env.example
│
├── database/
│   ├── schema.sql            # Table definitions for admins and blogs
│   └── seed.sql              # Initial optional demo data
│
├── .gitignore
├── README.md
└── package.json              # Unified root workspace launcher (Port 3000)
```

---

## 6. Database Setup (MySQL)

1. Open your MySQL client (CLI or MySQL Workbench):
```bash
mysql -u root -p < database/schema.sql
```

2. (Optional) Insert sample seed blogs and admin account:
```bash
mysql -u root -p < database/seed.sql
```

### Table Definitions

#### `admins` Table
| Column | Type | Attributes | Description |
|---|---|---|---|
| `id` | INT | PRIMARY KEY AUTO_INCREMENT | Unique identifier |
| `firebase_uid` | VARCHAR(255) | NOT NULL UNIQUE | Firebase Auth UID |
| `email` | VARCHAR(255) | NOT NULL | Admin email address |
| `name` | VARCHAR(255) | NULL | Admin display name |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Registration timestamp |

#### `blogs` Table
| Column | Type | Attributes | Description |
|---|---|---|---|
| `id` | INT | PRIMARY KEY AUTO_INCREMENT | Unique identifier |
| `title` | VARCHAR(255) | NOT NULL | Article title |
| `content` | TEXT | NOT NULL | Main article body |
| `tags` | VARCHAR(255) | NOT NULL | Comma-separated tags |
| `conclusion` | TEXT | NOT NULL | Article takeaway/conclusion |
| `status` | ENUM('Draft', 'Published') | NOT NULL DEFAULT 'Draft' | Publication state |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | Modification timestamp |

---

## 7. Firebase Authentication Setup

### Step 1: Create Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** and name it `utsanova-blog`.
3. In the sidebar, navigate to **Build > Authentication**.
4. Click **Get Started**, choose **Email/Password**, and enable it.

### Step 2: Create Admin User in Firebase Console
1. Under **Authentication > Users**, click **Add user**.
2. Enter email: `admin@utsanova.com` and a strong password (e.g. `admin123`).
3. Copy the generated **User UID** (e.g., `4kL89s...`).

### Step 3: Register Admin UID in MySQL
Run the following SQL statement in your MySQL database to authorize this UID for admin access:
```sql
USE utsanova_blog;

INSERT INTO admins (firebase_uid, email, name)
VALUES ('PASTE_YOUR_FIREBASE_UID_HERE', 'admin@utsanova.com', 'Utsanova Administrator')
ON DUPLICATE KEY UPDATE email=VALUES(email);
```

### Step 4: Obtain Firebase Admin SDK Credentials
1. In Firebase Console, go to **Project settings** (gear icon) > **Service accounts**.
2. Select **Node.js** and click **Generate new private key**.
3. Save the downloaded JSON file and configure your `server/.env` accordingly.

---

## 8. Environment Variables

### Backend (`server/.env`)
```ini
PORT=5000
DATABASE_HOST=localhost
DATABASE_USER=root
DATABASE_PASSWORD=your_mysql_password
DATABASE_NAME=utsanova_blog
DATABASE_PORT=3306

FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project-id.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Frontend (`client/.env`)
```ini
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=utsanova-blog.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=utsanova-blog
VITE_FIREBASE_STORAGE_BUCKET=utsanova-blog.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## 9. Local Development & Running

### Option A: Running as Separate Services (Standard Setup)

1. **Start the Backend**:
```bash
cd server
npm install
npm run dev
# Server starts on http://localhost:5000
```

2. **Start the Frontend**:
```bash
cd ../client
npm install
npm run dev
# Frontend starts on http://localhost:5173
```

### Option B: Running as Unified Project (Port 3000)
From the root workspace directory:
```bash
npm install
npm run dev
# Both Express REST API and Vite frontend run simultaneously on http://localhost:3000
```

---

## 10. API Endpoints Reference

### Public Endpoints
| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| `GET` | `/api/blogs` | `?search=...`, `?tag=...` | List all Published blogs |
| `GET` | `/api/blogs/:id` | - | Get single Published blog |

### Admin Endpoints (Requires `Authorization: Bearer <token>`)
| Method | Endpoint | Payload | Description |
|---|---|---|---|
| `GET` | `/api/admin/dashboard/stats` | - | Aggregated blog count & recent blogs |
| `GET` | `/api/admin/blogs` | `?status=Draft` | List all blogs (Draft + Published) |
| `GET` | `/api/admin/blogs/:id` | - | Get single blog by ID |
| `POST` | `/api/admin/blogs` | `{ title, content, tags, conclusion, status }` | Create new blog |
| `PUT` | `/api/admin/blogs/:id` | `{ title, content, tags, conclusion, status }` | Update existing blog |
| `DELETE` | `/api/admin/blogs/:id` | - | Delete blog |
| `POST` | `/api/admin/ai/generate-ai` | `{ topic, keywords }` | AI draft generation |

### Response Schema Standard
**Success (`200` / `201`)**:
```json
{
  "success": true,
  "data": { ... }
}
```

**Error (`400`, `401`, `403`, `404`, `500`)**:
```json
{
  "success": false,
  "message": "Error description"
}
```

---

## 11. Verification & Test Plan

- **TEST 1**: Navigate to `/admin/login`
- **TEST 2**: Sign in with administrator credentials (`admin@utsanova.com` / `admin123`).
- **TEST 3**: Verify redirection to `/admin/dashboard`.
- **TEST 4**: Confirm Total Blogs, Published Blogs, and Draft Blogs metrics match MySQL database count.
- **TEST 5**: Create a blog with status set to `Draft`.
- **TEST 6**: Verify the draft appears in `/admin/blogs` with amber "Draft" badge.
- **TEST 7**: Check `/blogs` in a separate browser window; verify the draft does **NOT** appear publicly.
- **TEST 8**: Change status of the blog from `Draft` to `Published`.
- **TEST 9**: Confirm it appears on `/blogs` immediately.
- **TEST 10**: Click on the blog to view the detail page (`/blogs/:id`); verify title, date, content, tags, and conclusion highlight box.
- **TEST 11**: Search for keywords in the search bar.
- **TEST 12**: Filter by tags (e.g., `Technology`, `React`).
- **TEST 13**: Edit the blog title and content; verify changes update in MySQL.
- **TEST 14**: Delete the blog via the confirmation modal.
- **TEST 15**: Click "Sign Out".
- **TEST 16**: Attempt to access `/admin/dashboard` while logged out; verify automatic redirect to `/admin/login`.
- **TEST 17**: Send an unauthenticated request to `/api/admin/blogs`; verify `401 Unauthorized` response.
- **TEST 18**: Authenticate with a non-admin Firebase UID; verify `403 Forbidden` response.

---

## 12. Corporate Information

**UTSANOVA TECHNOLOGIES PVT. LTD.**  
Website: [www.about.utsanova.com](https://www.about.utsanova.com)  
Email: [hr@utsanova.com](mailto:hr@utsanova.com)
