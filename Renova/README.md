# Renova - AI-Powered Interior Design Platform

[![Pipeline Status](https://git.ece.iastate.edu/sd/sdmay26-16/badges/main/pipeline.svg)](https://git.ece.iastate.edu/sd/sdmay26-16/-/pipelines)
[![Latest Release](https://git.ece.iastate.edu/sd/sdmay26-16/-/badges/release.svg)](https://git.ece.iastate.edu/sd/sdmay26-16/-/releases)

> Bringing together user creativity and artificial intelligence to make professional interior design accessible and risk-free.

## Overview

Renova is an AI-powered interior design platform that helps homeowners and renters visualize renovation ideas before spending money. Using an intuitive moodboard editor, users can arrange furniture and decor items over photos of their actual rooms and see AI-generated photorealistic previews of their design ideas.

### The Problem

Homeowners and renters struggle to visualize renovation ideas before making expensive purchases, leading to costly mistakes and dissatisfaction with their design choices.

### Our Solution

A user-friendly moodboard editor where you can:
- Arrange furniture and decor items over photos of your actual room
- See AI-generated previews of your design ideas
- Experiment risk-free before committing to purchases

### Key Features

- User authentication (JWT + Google OAuth)
- Interactive moodboard editor with drag-and-drop functionality
- 3D visualization capabilities
- AI-generated renovation previews using Stable Diffusion XL
- Real-time design collaboration

## Technology Stack

### Frontend
- **Next.js 15** - React framework with server-side rendering
- **React 19** - UI library
- **Ant Design** - Component library
- **Konva & React Konva** - Canvas-based graphics and interactions
- **Three.js** - 3D visualization
- **Tailwind CSS** - Utility-first CSS framework

### Backend
- **Node.js & Express** - REST API server
- **Prisma ORM** - Type-safe database access
- **MySQL 8.0** - Relational database
- **JWT** - Authentication and authorization
- **Google OAuth** - Third-party authentication

### AI/ML (In Development)
- **Python & FastAPI** - AI service backend
- **PyTorch** - Deep learning framework
- **MiDaS** - Depth estimation
- **SAM2** - Image segmentation
- **Stable Diffusion XL** - Photorealistic image generation

### DevOps
- **Docker & Docker Compose** - Containerization
- **GitLab CI/CD** - Automated testing and deployment
- **VMware** - Production hosting

## Prerequisites

- **Docker** and **Docker Compose** installed
- **Node.js 18+** (for local development without Docker)
- **MySQL 8.0** (for local development without Docker)
- **Git** for version control

## Getting Started

### Quick Start with Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://git.ece.iastate.edu/sd/sdmay26-16.git
   cd sdmay26-16
   ```

2. **Set up environment variables**

   Create `.env` file in the `backend` directory:
   ```bash
   cd backend
   cat > .env << EOF
   DATABASE_URL=mysql://renova:renova@mysql:3306/renova_dev
   JWT_SECRET=your-super-secret-jwt-key-change-this
   JWT_ACCESS_EXPIRES_IN=1h
   JWT_REFRESH_EXPIRES_IN=7d
   GOOGLE_CLIENT_ID=your-google-client-id
   PORT=8080
   EOF
   cd ..
   ```

   Create `.env` file in the `frontend` directory:
   ```bash
   cd frontend
   cat > .env << EOF
   NEXT_PUBLIC_API_URL=http://localhost:8080
   EOF
   cd ..
   ```

   > **Note:** In production, the frontend auto-detects the API URL from the browser's origin (no env variable needed when deploying to re-renova.com).

3. **Start the application**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8080
   - MySQL: localhost:3307

5. **View logs**
   ```bash
   docker-compose logs -f
   ```

6. **Stop the application**
   ```bash
   docker-compose down
   ```

### Local Development (Without Docker)

#### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your local MySQL credentials

# Run Prisma migrations
npx prisma migrate dev

# Start development server
npm run dev
```

Backend will run on http://localhost:8080

#### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your backend API URL

# Start development server
npm run dev
```

Frontend will run on http://localhost:3000

## Production Instance

The application is deployed on a VMware instance at **10.29.160.249** and accessible via **[re-renova.com](https://re-renova.com)**.

### Accessing the Production Instance

#### From anywhere (public domain)
- **Frontend**: https://re-renova.com
- **Backend API**: https://re-renova.com:8080

#### From Iowa State University network (on-campus / VPN)
- **Frontend**: http://10.29.160.249:3000
- **Backend API**: http://10.29.160.249:8080

#### Database (direct connection)
- **MySQL**: 10.29.160.249:3309

### Production Services Status

- MySQL running on port 3309
- Backend API running on port 8080
- Frontend application running on port 3000
- All services containerized using Docker Compose

### Connecting to Production MySQL

Using MySQL Workbench or CLI:
```bash
mysql -h 10.29.160.249 -P 3309 -u renova -p
```

## Project Structure

```
sdmay26-16/
├── frontend/                 # Next.js frontend application
│   ├── src/
│   │   ├── app/             # Next.js app router pages
│   │   ├── components/      # React components
│   │   ├── contexts/        # React context providers
│   │   ├── styles/          # Global styles and CSS modules
│   │   └── utils/           # Utility functions
│   ├── public/              # Static assets
│   ├── Dockerfile           # Frontend container config
│   └── package.json
├── backend/                  # Express.js backend API
│   ├── src/
│   │   ├── config/          # Configuration files
│   │   ├── controllers/     # Request handlers
│   │   ├── routes/          # API route definitions
│   │   ├── middleware/      # Custom middleware
│   │   ├── lib/             # Shared libraries
│   │   ├── features/        # Feature modules (health checks, etc.)
│   │   └── server.js        # Application entry point
│   ├── prisma/              # Database schema and migrations
│   ├── Dockerfile           # Backend container config
│   └── package.json
├── docs/                     # Project documentation
├── docker-compose.yml        # Docker services configuration
├── .gitlab-ci.yml           # CI/CD pipeline configuration
└── README.md                # This file
```

## API Endpoints

### Health Checks
- `GET /health` - Full health check with system metrics
- `GET /health/live` - Liveness probe (container restart)
- `GET /health/ready` - Readiness probe (database connection)

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/google` - Google OAuth login
- `POST /api/auth/refresh` - Refresh access token

### User Management
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile

### Moodboards
- `GET /api/moodboard` - List user's moodboards
- `POST /api/moodboard` - Create new moodboard
- `GET /api/moodboard/:id` - Get specific moodboard
- `PUT /api/moodboard/:id` - Update moodboard
- `DELETE /api/moodboard/:id` - Delete moodboard

## Development Workflow

### Running Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

### Database Management

```bash
# Open Prisma Studio (GUI for database)
cd backend
npm run prisma:studio

# Create a new migration
npm run prisma:migrate

# Reset database
npx prisma migrate reset
```

### Code Quality

```bash
# Lint frontend code
cd frontend
npm run lint

# Lint backend code
cd backend
npm run lint
```

## CI/CD Pipeline

The project uses GitLab CI/CD for automated testing and deployment. See [CICD_SETUP.md](./CICD_SETUP.md) for detailed information.

### Pipeline Stages

1. **Validate** - Install dependencies
2. **Test** - Run linting and security audits
3. **Build** - Build frontend and verify backend
4. **Docker** - Build and push Docker images (main branch only)
5. **Deploy** - Deploy to staging/production (manual trigger)

### CI/CD Features

- Automated dependency caching
- Security vulnerability scanning
- Docker image building with Kaniko
- Health check verification
- Manual deployment controls

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Ensure tests pass and code is linted
4. Submit a merge request
5. Wait for CI/CD pipeline to pass
6. Request code review

## Database Schema

The application uses Prisma ORM with MySQL. Key entities:

- **User** - User accounts and authentication
- **Moodboard** - Design projects
- **MoodboardItem** - Individual items in a moodboard
- **Session** - User sessions and refresh tokens

View the full schema in `backend/prisma/schema.prisma`

## Environment Variables

### Backend Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | MySQL connection string | `mysql://user:pass@host:3306/db` |
| `JWT_SECRET` | Secret key for JWT signing | `your-random-secret-key` |
| `JWT_ACCESS_EXPIRES_IN` | Access token expiry | `1h` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry | `7d` |
| `PORT` | Backend server port | `8080` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `your-client-id` |

### Frontend Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:8080` |

## Troubleshooting

### Docker Issues

**Services won't start**
```bash
# Check logs
docker-compose logs

# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up
```

**Database connection errors**
```bash
# Check if MySQL is ready
docker-compose ps
docker-compose logs mysql

# Wait for health check to pass
docker-compose up mysql
# Wait for "ready for connections" message
```

### Development Issues

**Port already in use**
```bash
# Find and kill the process using the port
lsof -ti:3000 | xargs kill  # Frontend
lsof -ti:8080 | xargs kill  # Backend
```

**Prisma migration issues**
```bash
cd backend
npx prisma migrate reset
npx prisma migrate dev
npx prisma generate
```

## License

This project is part of Senior Design at Iowa State University (sdmay26-16).

## Team

Senior Design Team - Spring 2026
Iowa State University - Department of Electrical and Computer Engineering

## Support

For issues and questions:
- Check existing [GitLab Issues](https://git.ece.iastate.edu/sd/sdmay26-16/-/issues)
- Review [Project Documentation](./docs/)
- Contact the development team

---

Made with care by the Renova team
