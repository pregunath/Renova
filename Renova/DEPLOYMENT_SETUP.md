# Automated Deployment Setup for Renova
**Author:** Om Sanghvi

This document explains how to set up automated deployment from GitLab to your production VM.

## Overview

When you push changes to the `main` branch:
1. GitLab CI/CD runs validation, tests, and builds
2. If all checks pass, it automatically deploys to the production VM
3. The VM pulls latest code and rebuilds Docker containers

## Setup Instructions

### Step 1: Add CI/CD Variables to GitLab

Go to your GitLab project: **Settings → CI/CD → Variables**

Add the following variables:

#### SSH_PRIVATE_KEY (Type: File, Protected: Yes, Masked: No)
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACDVjkDPoORxJyiY3XbLwJaL5kNcBAs4JM/xgcp4kaN3pAAAAJjgcY154HGN
eQAAAAtzc2gtZWQyNTUxOQAAACDVjkDPoORxJyiY3XbLwJaL5kNcBAs4JM/xgcp4kaN3pA
AAAEA9UnPjkrYzEnQwnE6cCAuzDRd8DGFwjNgX+htqN0Y8E9WOQM+g5HEnKJjddsvAlovm
Q1wECzgkz/GByniRo3ekAAAAEGdpdGxhYi1jaS1kZXBsb3kBAgMEBQ==
-----END OPENSSH PRIVATE KEY-----
```

#### DEPLOY_HOST (Type: Variable, Protected: Yes)
```
10.29.160.249
```

#### DEPLOY_USER (Type: Variable, Protected: Yes)
```
vm-user
```

### Step 2: Configure GitLab Runner (if needed)

Your GitLab instance needs at least one active runner. Check:
- Go to **Settings → CI/CD → Runners**
- Ensure at least one runner is available and active
- If no runners are available, you'll need to register one

### Step 3: Test the Deployment

1. Make a small change to your code
2. Commit and push to the `main` branch:
   ```bash
   git add .
   git commit -m "Test automated deployment"
   git push origin main
   ```
3. Go to **CI/CD → Pipelines** in GitLab
4. Watch the pipeline execute
5. If all stages pass, deployment will automatically run

### Step 4: Verify Deployment

After the pipeline completes:
- Check the pipeline logs for deployment status
- Access your application at: http://10.29.160.249:3000
- Verify containers are running: `docker ps`

## How It Works

### The Pipeline Flow

```
main branch push
    ↓
Validate (install dependencies)
    ↓
Test (linting, unit tests, security audit)
    ↓
Build (build apps, verify backend health)
    ↓
Docker (build and push Docker images)
    ↓
Deploy (SSH to VM and run deploy.sh) ← AUTOMATIC
```

### The Deployment Script

The `deploy.sh` script on the VM:
1. Pulls latest code from git
2. Stops running containers
3. Removes old images
4. Builds new containers with latest code
5. Starts containers in detached mode
6. Shows status and recent logs

## Troubleshooting

### Deployment fails with "Permission denied"
- Verify the SSH_PRIVATE_KEY is correctly copied (including BEGIN/END lines)
- Check that the public key is in `/home/vm-user/.ssh/authorized_keys`

### Docker commands fail in deploy.sh
- The vm-user needs Docker permissions
- Run: `sudo usermod -aG docker vm-user`
- Log out and back in for changes to take effect

### Pipeline stuck at deploy stage
- Check GitLab runner logs
- Verify DEPLOY_HOST is reachable from the runner
- Verify SSH port 22 is accessible

### Want to disable automatic deployment?
Edit `.gitlab-ci.yml` and change:
```yaml
when: on_success  # Change this to 'manual'
```

## Manual Deployment

If you need to deploy manually:
```bash
ssh vm-user@10.29.160.249
cd /home/vm-user/sdmay26-16
./deploy.sh
```

## Security Notes

- The SSH private key is stored securely in GitLab CI/CD variables
- Mark SSH_PRIVATE_KEY as "Protected" so it only works on protected branches
- Never commit the private key to your repository
- The deploy script only accepts connections from the configured SSH key

## File Locations

- Deployment script: `/home/vm-user/sdmay26-16/deploy.sh`
- SSH keys: `/home/vm-user/.ssh/gitlab_deploy_key` (private) and `gitlab_deploy_key.pub` (public)
- GitLab CI config: `/home/vm-user/sdmay26-16/.gitlab-ci.yml`
- This documentation: `/home/vm-user/sdmay26-16/DEPLOYMENT_SETUP.md`

---

**Questions or issues?** Contact Om Sanghvi
