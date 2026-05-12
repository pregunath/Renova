# GitLab CI/CD Setup Guide - Renova

## Quick Start

This project has a complete CI/CD pipeline configured. It automatically:
- ✅ Validates code and dependencies
- ✅ Runs linting and security audits
- ✅ Builds frontend and backend
- ✅ Tests backend health endpoints
- ✅ Builds and pushes Docker images (main branch only)
- ✅ Provides manual deployment options

## Pipeline Stages

```
validate → test → build → docker → deploy
```

### 1. Validate Stage
- `validate_backend` - Install backend dependencies
- `validate_frontend` - Install frontend dependencies

### 2. Test Stage
- `lint_frontend` - ESLint code quality check
- `test_backend` - Run backend tests (when configured)
- `test_frontend` - Run frontend tests (when configured)
- `security_audit` - npm audit for vulnerabilities

### 3. Build Stage
- `build_frontend_app` - Build Next.js production bundle
- `verify_backend` - Start backend and test health endpoints

### 4. Docker Stage (main branch + merge requests only)
- `docker_build_backend` - Build and push backend Docker image
- `docker_build_frontend` - Build and push frontend Docker image

### 5. Deploy Stage (main branch, manual trigger)
- `deploy_staging` - Deploy to staging environment
- `deploy_production` - Deploy to production environment

## Required CI/CD Variables

Go to **Settings → CI/CD → Variables** and add:

### Core Variables (Auto-provided by GitLab)
- `CI_REGISTRY` - GitLab Container Registry URL (auto)
- `CI_REGISTRY_USER` - Registry username (auto)
- `CI_REGISTRY_PASSWORD` - Registry password (auto)
- `CI_REGISTRY_IMAGE` - Image path (auto)

### Application Variables (You need to add these)

#### Backend Environment Variables
| Variable | Example | Required | Description |
|----------|---------|----------|-------------|
| `DATABASE_URL` | `mysql://user:pass@host:3306/db` | ✅ | Database connection string |
| `JWT_SECRET` | `your-random-secret-key` | ✅ | JWT signing secret (generate strong key) |
| `JWT_ACCESS_EXPIRES_IN` | `1h` | No | Access token expiry (default: 1h) |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | No | Refresh token expiry (default: 7d) |
| `CORS_ORIGIN` | `https://app.example.com` | No | Allowed CORS origins |
| `GOOGLE_CLIENT_ID` | `your-google-client-id` | No | Google OAuth client ID |

#### Frontend Environment Variables
| Variable | Example | Required | Description |
|----------|---------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | `https://api.example.com` | ✅ | Backend API URL |

#### Deployment Variables (Optional - for automated deployment)
| Variable | Example | Required | Description |
|----------|---------|----------|-------------|
| `STAGING_DEPLOY_URL` | `https://webhook.staging.com` | No | Staging deployment webhook |
| `PRODUCTION_DEPLOY_URL` | `https://webhook.prod.com` | No | Production deployment webhook |

## Health Check Endpoints

The backend provides comprehensive health monitoring:

### `/health` - Full Health Check
```json
{
  "status": "ok",
  "timestamp": "2025-01-05T12:00:00Z",
  "uptime": 3600,
  "memory": {
    "rss": 150,
    "heapUsed": 75
  },
  "services": {
    "database": {
      "status": "ok",
      "responseTime": "12ms"
    }
  }
}
```

### `/health/live` - Liveness Probe
Simple check that the app is running. Use for container restart policies.

### `/health/ready` - Readiness Probe
Checks if app is ready to receive traffic (database connected). Use for load balancers.

## Docker Images

Images are automatically built and pushed to GitLab Container Registry:

```bash
# Pull images
docker pull registry.git.ece.iastate.edu/sd/sdmay26-16/backend:latest
docker pull registry.git.ece.iastate.edu/sd/sdmay26-16/frontend:latest

# Or specific commit
docker pull registry.git.ece.iastate.edu/sd/sdmay26-16/backend:abc1234
```

View images at: **Packages & Registries → Container Registry**

## Deployment

### Manual Deployment (Current Setup)

1. Go to **CI/CD → Pipelines** → Click latest pipeline
2. Navigate to the `deploy` stage
3. Click ▶️ on `deploy_staging` or `deploy_production`
4. The job will show you the image tags to deploy

### Configure Automated Deployment

**Option 1: Webhook Deployment**
1. Set `STAGING_DEPLOY_URL` or `PRODUCTION_DEPLOY_URL` in CI/CD variables
2. Pipeline will POST deployment details to your webhook
3. Your webhook handler pulls and restarts containers

**Option 2: SSH Deployment**
1. Add deployment script in `deploy_staging` job
2. Configure SSH key in CI/CD variables (`SSH_PRIVATE_KEY`)
3. Script SSHs to server and runs deployment commands

**Option 3: Kubernetes**
1. Configure kubectl in deployment job
2. Use `kubectl set image` to update deployments
3. Kubernetes will roll out new containers

## Security Features

### Dependency Scanning
- `security_audit` job runs `npm audit` on every commit
- Checks for known vulnerabilities in dependencies
- Marked as `allow_failure: true` (won't block pipeline)
- Review security warnings in job logs

### Container Registry
- Images stored in private GitLab registry
- Access controlled by project permissions
- Automatic cleanup of old images via retention policies

## Troubleshooting

### Pipeline fails on verify_backend
**Cause:** Backend can't start or health checks fail
**Fix:** Check job logs for specific error. Common issues:
- Database connection failure
- Missing environment variables
- Prisma migration issues

### Docker build fails with "lookup docker"
**Cause:** This shouldn't happen anymore (we use Kaniko)
**Fix:** Verify jobs use `gcr.io/kaniko-project/executor` image

### Tests failing
**Tests are currently `allow_failure: true`** - they won't block the pipeline.
To enforce tests:
1. Add test framework (Jest/Vitest)
2. Write tests
3. Remove `allow_failure: true` from test jobs

## Performance Optimizations

✅ **Dependency Caching** - `node_modules` cached per branch
✅ **Conditional Docker Builds** - Only on main/merge requests
✅ **Parallel Jobs** - Multiple jobs run simultaneously
✅ **Kaniko** - Efficient container builds without Docker daemon

## Next Steps

1. **Add Tests** - Configure Jest/Vitest for real test coverage
2. **Configure Deployment** - Set up staging/production environments
3. **Add Monitoring** - Integrate health checks with monitoring tools
4. **Enable Branch Protection** - Require pipeline success before merge
5. **Set Up Notifications** - Add Slack/Discord alerts for failures

## Support

- View pipeline status: **CI/CD → Pipelines**
- View Docker images: **Packages & Registries → Container Registry**
- Configure variables: **Settings → CI/CD → Variables**
- Pipeline configuration: `.gitlab-ci.yml`
- Health endpoints: `backend/src/features/health/health.routes.js`

---

**Pipeline Status:** [![Pipeline](https://git.ece.iastate.edu/sd/sdmay26-16/badges/main/pipeline.svg)](https://git.ece.iastate.edu/sd/sdmay26-16/-/pipelines)
