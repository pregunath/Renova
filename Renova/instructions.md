# Setup Instructions & Missing Configuration

This file tracks missing environment variables and setup steps for future reference.

## Missing Environment Variables

### Backend (`backend/.env`)

#### Google OAuth (Optional)
```env
GOOGLE_CLIENT_ID="your-google-client-id-here"
```
**Status:** Not configured
**Required for:** Google Sign-In functionality
**How to get:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs

---

#### AWS S3 (Optional)
```env
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_REGION="us-east-2"
S3_BUCKET_NAME="your-bucket-name"
```
**Status:** Not configured
**Required for:** Image uploads and media storage
**How to get:**
1. Go to [AWS Console](https://console.aws.amazon.com/)
2. Create an S3 bucket
3. Create IAM user with S3 access
4. Generate access keys

---

#### Pinterest Integration (Optional)
```env
PINTEREST_CLIENT_ID="your-pinterest-app-id"
PINTEREST_CLIENT_SECRET="your-pinterest-app-secret"
PINTEREST_REDIRECT_URI="http://10.29.160.249:8080/api/integrations/pinterest/callback"
```
**Status:** Not configured
**Required for:** Pinterest board import functionality
**How to get:**
1. Go to [Pinterest Developers](https://developers.pinterest.com/)
2. Create a new app
3. Get App ID and App Secret
4. Set redirect URI to match your backend URL

---

### Frontend (`frontend/.env`)

#### Google OAuth (Optional)
```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your-google-client-id-here"
```
**Status:** Not configured
**Required for:** Google Sign-In button
**Note:** Must match the backend Google Client ID

---

#### Pinterest (Optional)
```env
NEXT_PUBLIC_PINTEREST_APP_ID="your-pinterest-app-id"
```
**Status:** Not configured
**Required for:** Pinterest OAuth flow
**Note:** Must match the backend Pinterest Client ID

---

## Configured Environment Variables

### Backend
- ✅ `DATABASE_URL` - MySQL connection string
- ✅ `PORT` - Backend port (8080)
- ✅ `NODE_ENV` - Environment (development)
- ✅ `JWT_SECRET` - Authentication secret (auto-generated)
- ✅ `FRONTEND_URL` - Frontend URL for redirects
- ✅ `CORS_ORIGIN` - CORS configuration

### Frontend
- ✅ `PORT` - Frontend port (3000)
- ✅ `NEXT_PUBLIC_API_BASE_URL` - Backend API URL (dynamic detection enabled)

---

## Notes

- JWT_SECRET was auto-generated on 2025-12-08
- Dynamic IPv4/IPv6 detection is enabled for frontend API calls
- Database persists across deployments via Docker named volumes

---

**Last Updated:** 2025-12-08
