# RENOVA Backend API

**Base URL:** `http://localhost:8080`

---

## 🔐 Authentication

### POST `/api/auth/register`
Registers a new user.  
**Body**
```json
{
  "email": "user@example.com",
  "password": "Passw0rd!",
  "name": "John Doe",
  "occupation": "Designer"
}
```

---

### POST `/api/auth/login`
Logs in an existing user.  
**Body**
```json
{
  "email": "user@example.com",
  "password": "Passw0rd!"
}
```

---

### POST `/api/auth/refresh`
Returns a new access token, rotating the refresh token.  
The refresh token is now stored as an **HttpOnly, Secure, SameSite=Strict cookie** named `refreshToken`. You do **not** need to send it in the body. For backward compatibility a `refreshToken` field in the body is accepted but discouraged.

Client requests must include credentials (e.g. `fetch(url, { credentials: 'include' })`).

**Body (optional)**
```json
{}
```

---

### POST `/api/auth/google`
Logs in or registers using Google Sign-In.  
**Body**
```json
{
  "idToken": "<google_id_token>"
}
```

---

## 👤 User Endpoints

### GET `/api/user/me`
Returns the authenticated user.  
**Header**
```
Authorization: Bearer <access_token>
```

**Response**
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe",
  "occupation": "Designer",
  "createdAt": "2025-10-29T19:12:00.000Z"
}
```

---

### PATCH `/api/user/me`
Updates the authenticated user.  
**Header**
```
Authorization: Bearer <access_token>
```

**Body**
```json
{
  "name": "Updated Name",
  "occupation": "Updated Occupation",
  "password": "NewPass123!"
}
```

---

## 🧱 Moodboard Endpoints

### GET `/api/moodboard`
Returns a list of moodboards belonging to the authenticated user (lightweight view).  
**Header**
```
Authorization: Bearer <access_token>
```
**Response**
```json
[
  {
    "id": 1,
    "title": "Living Room Project",
    "thumbnailUrl": "https://cdn.renova.app/thumbnails/1.png",
    "updatedAt": "2025-10-29T19:12:00.000Z"
  },
  {
    "id": 2,
    "title": "Office Redesign",
    "thumbnailUrl": null,
    "updatedAt": "2025-10-28T18:00:00.000Z"
  }
]
```

---

### GET `/api/moodboard/:id`
Returns a full moodboard (including the React-Konva scene JSON).  
**Header**
```
Authorization: Bearer <access_token>
```
**Response**
```json
{
  "id": 1,
  "title": "Living Room Project",
  "scene": { "className": "Stage", "children": [] },
  "width": 900,
  "height": 600,
  "background": "#ffffff",
  "thumbnailUrl": "https://cdn.renova.app/thumbnails/1.png",
  "isPublic": true,
  "createdAt": "2025-10-29T18:30:00.000Z",
  "updatedAt": "2025-10-29T19:12:00.000Z"
}
```

---

### POST `/api/moodboard`
Creates a new moodboard.  
**Header**
```
Authorization: Bearer <access_token>
```
**Body**
```json
{
  "title": "New Moodboard",
  "scene": { "className": "Stage", "children": [] },
  "width": 900,
  "height": 600,
  "background": "#ffffff",
  "thumbnailUrl": null,
  "isPublic": true
}
```

---

### PATCH `/api/moodboard/:id`
Updates an existing moodboard (e.g., when the user saves).  
**Header**
```
Authorization: Bearer <access_token>
```
**Body**
```json
{
  "scene": { "className": "Stage", "children": [] },
  "background": "#f5f5f5",
  "thumbnailUrl": "https://cdn.renova.app/thumbnails/1.png"
}
```

---

### DELETE `/api/moodboard/:id`
Deletes a moodboard by ID.  
**Header**
```
Authorization: Bearer <access_token>
```

**Response:**  
`204 No Content`

---

## 🛠️ Admin Endpoints

### GET `/api/user`
Lists all users.  
**Header**
```
Authorization: Bearer <admin_access_token>
```

### GET `/api/user/:id`
Retrieves a user by ID.  
**Header**
```
Authorization: Bearer <admin_access_token>
```

### PATCH `/api/user/:id`
Updates a user by ID.  
**Header**
```
Authorization: Bearer <admin_access_token>
```

### DELETE `/api/user/:id`
Deletes a user by ID.  
**Header**
```
Authorization: Bearer <admin_access_token>
```

---

## ⚙️ Environment Variables

```ini
PORT=8080
NODE_ENV=development
DATABASE_URL=mysql://root@localhost:3306/renova_dev
JWT_SECRET=*****
JWT_ACCESS_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=1d
JWT_ISSUER=sdmay26-16-backend
JWT_AUDIENCE=sdmay26-16-frontend
## 🔄 Token Rotation & Revocation

- Refresh tokens are issued with a unique `jti` and persisted in the `refresh_tokens` table.
- Each call to `/api/auth/refresh` revokes the previous refresh token and sets a new one via `Set-Cookie`.
- `/api/auth/logout` clears the refresh cookie. Optionally send `{ "allDevices": true }` in the body (with a valid access token) to revoke all active refresh tokens for that user.
- Access tokens remain stateless and short-lived.

## 💡 Frontend Integration Changes

- Do not store the refresh token in `localStorage` anymore; only the access token is kept client-side.
- Ensure all authenticated requests use `credentials: 'include'` so the refresh cookie is sent.
- On a 401 due to access token expiry, call `/api/auth/refresh` without a body and retry using the new access token.

CORS_ORIGIN=http://localhost:3000
GOOGLE_CLIENT_ID=*****
```
