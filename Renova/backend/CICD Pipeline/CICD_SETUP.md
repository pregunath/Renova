# GitLab CI/CD Setup Guide for Renova

This document provides complete instructions for setting up the GitLab CI/CD pipeline for the Renova project.

## Table of Contents
1. [Overview](#overview)
2. [GitLab Runner Configuration](#gitlab-runner-configuration)
3. [Required CI/CD Variables](#required-cicd-variables)
4. [Pipeline Stages](#pipeline-stages)
5. [Testing the Pipeline](#testing-the-pipeline)
6. [Deployment Configuration](#deployment-configuration)
7. [Troubleshooting](#troubleshooting)

---

## Overview

The CI/CD pipeline consists of 4 stages:
- **Lint**: Code quality checks for frontend and backend
- **Build**: Docker image creation and registry push
- **Test**: Automated testing (unit, integration)
- **Deploy**: Deployment to staging/production environments

The pipeline supports:
- ✅ Docker-based builds for both services
- ✅ GitLab Container Registry integration
- ✅ Separate frontend and backend testing
- ✅ Docker Compose validation
- ✅ Manual deployment controls
- ✅ Multiple deployment targets (SSH, Vercel)

---

## GitLab Runner Configuration

### Option 1: Using Shared Runners (Recommended for Quick Start)

If your GitLab instance has shared runners with Docker support:

1. Go to **Settings → CI/CD → Runners**
2. Enable **shared runners** for your project
3. Ensure the runner has the `docker` tag

No additional configuration needed!

### Option 2: Installing a Project-Specific Runner

If you need a dedicated runner:

#### On Linux/Mac:

```bash
# Download GitLab Runner
curl -LJO "https://gitlab-runner-downloads.s3.amazonaws.com/latest/binaries/gitlab-runner-linux-amd64"

# Give it permissions to execute
chmod +x gitlab-runner-linux-amd64

# Move to /usr/local/bin
sudo mv gitlab-runner-linux-amd64 /usr/local/bin/gitlab-runner

# Create a GitLab Runner user
sudo useradd --comment 'GitLab Runner' --create-home gitlab-runner --shell /bin/bash

# Install and run as service
sudo gitlab-runner install --user=gitlab-runner --working-directory=/home/gitlab-runner
sudo gitlab-runner start
```

#### Register the Runner:

1. Go to **Settings → CI/CD → Runners** in GitLab
2. Click **New project runner**
3. Copy the registration token
4. Run the registration command:

```bash
sudo gitlab-runner register
```

When prompted, enter:
- **GitLab instance URL**: Your GitLab URL (e.g., https://gitlab.com)
- **Registration token**: From step 3
- **Description**: `Renova Docker Runner`
- **Tags**: `docker` (important!)
- **Executor**: `docker`
- **Default Docker image**: `docker:24-dind`

#### Configure Docker-in-Docker:

Edit `/etc/gitlab-runner/config.toml`:

```toml
[[runners]]
  name = "Renova Docker Runner"
  url = "https://gitlab.com/"
  token = "YOUR_RUNNER_TOKEN"
  executor = "docker"
  [runners.docker]
    tls_verify = false
    image = "docker:24-dind"
    privileged = true
    disable_entrypoint_overwrite = false
    oom_kill_disable = false
    disable_cache = false
    volumes = ["/certs/client", "/cache"]
    shm_size = 0
  [runners.cache]
    [runners.cache.s3]
    [runners.cache.gcs]
    [runners.cache.azure]
```

Then restart the runner:
```bash
sudo gitlab-runner restart
```

---

## Required CI/CD Variables

Go to **Settings → CI/CD → Variables** and add the following:

### Core Variables (Required for all environments)

| Variable | Type | Value | Protected | Masked | Description |
|----------|------|-------|-----------|--------|-------------|
| `CI_REGISTRY` | Variable | `registry.gitlab.com` | ✅ | ❌ | GitLab Container Registry URL |
| `CI_REGISTRY_USER` | Variable | `gitlab-ci-token` | ✅ | ❌ | Auto-provided by GitLab |
| `CI_REGISTRY_PASSWORD` | Variable | `$CI_JOB_TOKEN` | ✅ | ✅ | Auto-provided by GitLab |

### Backend Environment Variables

| Variable | Type | Value | Protected | Masked | Description |
|----------|------|-------|-----------|--------|-------------|
| `DATABASE_URL` | Variable | `mysql://user:pass@host:3306/db` | ✅ | ✅ | Development database connection |
| `JWT_SECRET` | Variable | Your secret key (generate new) | ✅ | ✅ | JWT signing secret |
| `JWT_ACCESS_EXPIRES_IN` | Variable | `1h` | ❌ | ❌ | Access token expiry |
| `JWT_REFRESH_EXPIRES_IN` | Variable | `7d` | ❌ | ❌ | Refresh token expiry |
| `CORS_ORIGIN` | Variable | `http://localhost:3000` | ❌ | ❌ | Allowed CORS origins |
| `GOOGLE_CLIENT_ID` | Variable | Your Google OAuth client ID | ✅ | ❌ | Google authentication |

### Frontend Environment Variables

| Variable | Type | Value | Protected | Masked | Description |
|----------|------|-------|-----------|--------|-------------|
| `NEXT_PUBLIC_API_URL` | Variable | `http://localhost:8080` | ❌ | ❌ | Backend API URL |

### Staging Deployment Variables (Optional)

| Variable | Type | Value | Protected | Masked | Description |
|----------|------|-------|-----------|--------|-------------|
| `SSH_PRIVATE_KEY` | File | Your SSH private key | ✅ | ✅ | For SSH deployment |
| `STAGING_SERVER` | Variable | `staging.example.com` | ✅ | ❌ | Staging server hostname |
| `STAGING_USER` | Variable | `deploy` | ✅ | ❌ | SSH username |
| `STAGING_DEPLOY_PATH` | Variable | `/var/www/renova` | ✅ | ❌ | Deployment directory |
| `STAGING_URL` | Variable | `https://staging.example.com` | ✅ | ❌ | Staging URL |

### Production Deployment Variables (Optional)

| Variable | Type | Value | Protected | Masked | Description |
|----------|------|-------|-----------|--------|-------------|
| `PRODUCTION_SERVER` | Variable | `production.example.com` | ✅ | ❌ | Production server |
| `PRODUCTION_USER` | Variable | `deploy` | ✅ | ❌ | SSH username |
| `PRODUCTION_DEPLOY_PATH` | Variable | `/var/www/renova` | ✅ | ❌ | Deployment directory |
| `PRODUCTION_DATABASE_URL` | Variable | Production DB URL | ✅ | ✅ | Production database |
| `PRODUCTION_JWT_SECRET` | Variable | Production JWT secret | ✅ | ✅ | Production JWT secret |
| `PRODUCTION_CORS_ORIGIN` | Variable | `https://example.com` | ✅ | ❌ | Production CORS |
| `PRODUCTION_API_URL` | Variable | `https://api.example.com` | ✅ | ❌ | Production API URL |
| `PRODUCTION_URL` | Variable | `https://example.com` | ✅ | ❌ | Production URL |

### Vercel Deployment (Optional)

| Variable | Type | Value | Protected | Masked | Description |
|----------|------|-------|-----------|--------|-------------|
| `VERCEL_TOKEN` | Variable | Your Vercel token | ✅ | ✅ | Vercel API token |

---

## Pipeline Stages

### 1. Lint Stage

**Purpose**: Ensures code quality and consistency

**Jobs**:
- `lint:frontend` - Runs ESLint on Next.js code
- `lint:backend` - Runs ESLint on Express code (auto-installs if needed)

**When**: Runs on every push that changes frontend/backend files

**Cache**: npm dependencies cached for faster runs

### 2. Build Stage

**Purpose**: Creates Docker images and pushes to GitLab Container Registry

**Jobs**:
- `build:backend` - Builds backend Docker image with Node.js 20
- `build:frontend` - Builds frontend Docker image with Next.js
- `build:docker-compose` - Validates docker-compose.yml configuration

**When**: Runs when respective files change

**Artifacts**: Docker images tagged with commit SHA and "latest"

**Registry**: Images pushed to `$CI_REGISTRY_IMAGE/[service]:[tag]`

### 3. Test Stage

**Purpose**: Runs automated tests to ensure code correctness

**Jobs**:
- `test:backend` - Unit/integration tests with MySQL test database
- `test:frontend` - Component and unit tests
- `test:integration` - Full stack integration tests with docker-compose

**When**: Runs when test files or source code changes

**Database**: Uses MySQL 8.0 service container for backend tests

**Note**: Currently set to `allow_failure: true` since test frameworks are not yet configured. Remove this once Jest/Vitest is added.

### 4. Deploy Stage

**Purpose**: Deploys application to target environments

**Jobs**:
- `deploy:staging` - Deploys to staging via SSH (manual trigger)
- `deploy:production` - Deploys to production via SSH (manual trigger)
- `deploy:vercel` - Deploys frontend to Vercel (manual trigger, optional)

**When**: Manual deployment on `main` branch only

**Process**:
1. SSH into target server
2. Pull latest code
3. Create .env files from CI/CD variables
4. Run docker-compose up with build
5. Apply Prisma database migrations
6. Verify service health

---

## Testing the Pipeline

### Step 1: Commit and Push

Make a small change and push to GitLab:

```bash
git add .gitlab-ci.yml CICD_SETUP.md
git commit -m "Add GitLab CI/CD pipeline configuration"
git push origin B-CICD
```

### Step 2: Monitor Pipeline

1. Go to **CI/CD → Pipelines** in GitLab
2. Click on the latest pipeline
3. Watch each stage execute

### Step 3: View Job Logs

Click on any job to see detailed logs. Common checks:

**Lint jobs**: Should pass if code follows ESLint rules
**Build jobs**: Should successfully build Docker images
**Test jobs**: May show warnings if tests not configured (expected)

### Step 4: Verify Docker Images

After build stage completes:

1. Go to **Packages & Registries → Container Registry**
2. You should see:
   - `backend:latest` and `backend:[commit-sha]`
   - `frontend:latest` and `frontend:[commit-sha]`

### Step 5: Test Locally with Built Images

Pull and run the images locally:

```bash
# Login to GitLab registry
docker login registry.gitlab.com

# Pull images
docker pull registry.gitlab.com/[your-group]/[your-project]/backend:latest
docker pull registry.gitlab.com/[your-group]/[your-project]/frontend:latest

# Run with docker-compose (update docker-compose.yml to use registry images)
docker-compose up
```

---

## Deployment Configuration

### SSH-Based Deployment Setup

For staging and production deployment to work:

#### 1. Generate SSH Key Pair

On your local machine:
```bash
ssh-keygen -t ed25519 -C "gitlab-ci@renova" -f gitlab-ci-key
```

This creates:
- `gitlab-ci-key` (private key) → Add to GitLab CI/CD variables
- `gitlab-ci-key.pub` (public key) → Add to target server

#### 2. Configure Target Server

On your staging/production server:

```bash
# Create deploy user
sudo adduser deploy

# Add to docker group
sudo usermod -aG docker deploy

# Setup SSH access
sudo su - deploy
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Add public key
nano ~/.ssh/authorized_keys
# Paste content of gitlab-ci-key.pub
chmod 600 ~/.ssh/authorized_keys
exit

# Create deployment directory
sudo mkdir -p /var/www/renova
sudo chown deploy:deploy /var/www/renova

# Install Docker and Docker Compose
sudo apt-get update
sudo apt-get install -y docker.io docker-compose git

# Clone repository
cd /var/www/renova
git clone [your-repo-url] .
```

#### 3. Add Variables to GitLab

```bash
# Copy private key content
cat gitlab-ci-key

# Add to GitLab:
# Settings → CI/CD → Variables
# Name: SSH_PRIVATE_KEY
# Value: [paste full private key including BEGIN/END lines]
# Type: File
# Protected: Yes
# Masked: Yes
```

### Vercel Deployment Setup (Alternative for Frontend)

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login and get token:
```bash
vercel login
vercel --token
```

3. Link project:
```bash
cd frontend
vercel link
```

4. Add token to GitLab variables:
- Name: `VERCEL_TOKEN`
- Value: [your token]

---

## Troubleshooting

### Pipeline Fails at Docker Build

**Error**: `Cannot connect to Docker daemon`

**Solution**:
- Ensure GitLab Runner has `privileged = true` in config
- Check Docker-in-Docker service is running
- Verify runner has `docker` tag

### Docker Registry Authentication Failed

**Error**: `unauthorized: authentication required`

**Solution**:
- Check `CI_REGISTRY_PASSWORD` is set to `$CI_JOB_TOKEN`
- Ensure registry is enabled: Settings → General → Visibility → Container Registry

### SSH Deployment Fails

**Error**: `Permission denied (publickey)`

**Solution**:
- Verify SSH_PRIVATE_KEY variable is correctly set
- Check public key is in `~/.ssh/authorized_keys` on target server
- Test SSH connection manually: `ssh -i gitlab-ci-key deploy@your-server`

### Database Migration Fails

**Error**: `Prisma migrate failed`

**Solution**:
- Check DATABASE_URL is correct
- Ensure database is accessible from CI/CD runner
- Verify MySQL service is healthy (if using service container)

### Tests Fail with "Command not found"

**Error**: `npm test: command not found`

**Solution**:
- This is expected if test framework not configured yet
- Jobs are set to `allow_failure: true`
- Add Jest or Vitest to package.json and update test scripts

### Docker Compose Service Won't Start

**Error**: `Container exited with code 1`

**Solution**:
- Check environment variables are properly passed
- View logs: `docker-compose logs [service]`
- Ensure .env files are created correctly in deployment script

---

## Next Steps

1. **Add Testing Frameworks**:
   ```bash
   # Backend
   cd backend
   npm install --save-dev jest @types/jest supertest

   # Frontend
   cd frontend
   npm install --save-dev jest @testing-library/react @testing-library/jest-dom
   ```

2. **Set Up Test Scripts**:
   Update `package.json` with proper test commands and remove `allow_failure: true` from test jobs.

3. **Configure Deployment**:
   - Set up staging/production servers
   - Add all required CI/CD variables
   - Test manual deployment

4. **Add Health Endpoints**:
   Create `/api/health` endpoint in backend for health checks.

5. **Enable Auto-Deploy** (Optional):
   Remove `when: manual` from deploy jobs for automatic deployment on main branch.

6. **Security Scanning** (Optional):
   Add security scanning stages:
   - Dependency scanning
   - Container scanning
   - SAST (Static Application Security Testing)

---

## Pipeline Status Badge

Add this to your README.md:

```markdown
[![Pipeline Status](https://gitlab.com/[your-group]/[your-project]/badges/main/pipeline.svg)](https://gitlab.com/[your-group]/[your-project]/-/commits/main)
```

---

## Support

For issues with the CI/CD pipeline:
1. Check **CI/CD → Pipelines** for detailed logs
2. Review this documentation
3. Contact the DevOps team
4. Refer to [GitLab CI/CD documentation](https://docs.gitlab.com/ee/ci/)
