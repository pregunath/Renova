# Health Check Feature 🏥

> **TL;DR**: Three endpoints that tell you if your backend is healthy, alive, and ready to handle traffic. Perfect for monitoring, CI/CD, and debugging production issues.

## 📍 Endpoints

| Endpoint | Purpose | When to Use |
|----------|---------|-------------|
| `GET /health` | Full system health check | Monitoring dashboards, alerts, debugging |
| `GET /health/live` | Is the app running? | Kubernetes liveness probes, Docker health checks |
| `GET /health/ready` | Can it handle traffic? | Load balancers, deployment verification |

---

## 🚀 Quick Start - Testing the Endpoints

### 1. Main Health Check
```bash
curl http://localhost:8080/health
```

**Returns:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-14T19:56:55.850Z",
  "uptime": 123,
  "environment": "development",
  "memory": {
    "rss": 68,
    "heapUsed": 10,
    "heapTotal": 19
  },
  "services": {
    "database": {
      "status": "ok",
      "responseTime": "5ms"
    }
  },
  "responseTime": "8ms"
}
```

### 2. Liveness Check
```bash
curl http://localhost:8080/health/live
```

**Returns:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-14T19:56:33.433Z"
}
```

### 3. Readiness Check
```bash
curl http://localhost:8080/health/ready
```

**Returns:**
```json
{
  "status": "ready",
  "timestamp": "2025-10-14T19:57:01.320Z"
}
```

---

## ➕ How to Add a New Service Check

**Copy-paste this template** into `health.routes.js` inside the `serviceChecks` object:

### Example 1: Redis Cache Check

```javascript
const serviceChecks = {
  database: async () => { /* existing code */ },

  // 👇 ADD YOUR NEW CHECK HERE
  redis: async () => {
    try {
      const start = Date.now();
      await redis.ping(); // Replace with your check
      const responseTime = Date.now() - start;
      return {
        status: 'ok',
        responseTime: `${responseTime}ms`
      };
    } catch (error) {
      // If not configured yet (optional services only)
      if (error.message.includes('ECONNREFUSED')) {
        return {
          status: 'not_configured',
          message: 'Redis not configured',
          details: 'Set REDIS_URL in .env to enable'
        };
      }
      // Real error
      console.error('[Health Check] Redis error:', error.message);
      return {
        status: 'error',
        message: error.message
      };
    }
  },
};
```

### Example 2: External API Check

```javascript
  externalAPI: async () => {
    try {
      const start = Date.now();
      const response = await fetch('https://api.example.com/health');
      const responseTime = Date.now() - start;

      if (response.ok) {
        return {
          status: 'ok',
          responseTime: `${responseTime}ms`
        };
      } else {
        return {
          status: 'error',
          message: `API returned ${response.status}`,
          responseTime: `${responseTime}ms`
        };
      }
    } catch (error) {
      console.error('[Health Check] External API error:', error.message);
      return {
        status: 'error',
        message: error.message
      };
    }
  },
```

### Example 3: File System Check

```javascript
  fileSystem: async () => {
    try {
      const fs = require('fs').promises;
      const start = Date.now();
      await fs.access('./uploads'); // Check if uploads folder exists
      const responseTime = Date.now() - start;
      return {
        status: 'ok',
        responseTime: `${responseTime}ms`
      };
    } catch (error) {
      console.error('[Health Check] File system error:', error.message);
      return {
        status: 'error',
        message: 'Uploads directory not accessible',
        details: error.message
      };
    }
  },
```

### Example 4: Message Queue Check (RabbitMQ/AWS SQS)

```javascript
  messageQueue: async () => {
    try {
      const start = Date.now();
      // Example: Check RabbitMQ connection
      await channel.checkQueue('myQueue');
      const responseTime = Date.now() - start;
      return {
        status: 'ok',
        responseTime: `${responseTime}ms`
      };
    } catch (error) {
      console.error('[Health Check] Message queue error:', error.message);
      return {
        status: 'error',
        message: error.message
      };
    }
  },
```

---

## 🎯 Status Meanings

| Status | Meaning | HTTP Code | What to Do |
|--------|---------|-----------|------------|
| `ok` | Everything working perfectly | 200 | 👍 Nothing - keep monitoring |
| `not_configured` | Service not set up yet | 200 | ℹ️ Normal during development |
| `degraded` | One or more services have errors | 503 | ⚠️ Investigate failing services |
| `error` | Specific service is broken | - | 🚨 Fix the broken service ASAP |

---

## 🔧 Common Use Cases

### Use Case 1: CI/CD Pipeline - Verify Deployment

After deploying, wait for the service to be ready:

```bash
#!/bin/bash
# deploy-check.sh

echo "Waiting for service to be ready..."
for i in {1..30}; do
  if curl -f http://your-app.com/health/ready; then
    echo "✅ Service is ready!"
    exit 0
  fi
  echo "Attempt $i/30 - not ready yet, waiting..."
  sleep 5
done

echo "❌ Service failed to become ready"
exit 1
```

### Use Case 2: Docker Health Check

Add to your `Dockerfile`:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8080/health/live || exit 1
```

### Use Case 3: Kubernetes Probes

Add to your Kubernetes deployment:

```yaml
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: backend
    image: your-backend:latest
    livenessProbe:
      httpGet:
        path: /health/live
        port: 8080
      initialDelaySeconds: 30
      periodSeconds: 10
    readinessProbe:
      httpGet:
        path: /health/ready
        port: 8080
      initialDelaySeconds: 10
      periodSeconds: 5
```

### Use Case 4: Load Balancer Health Check (AWS ALB, GCP)

Configure your load balancer to hit:
- **Health check path**: `/health/ready`
- **Healthy threshold**: 2 consecutive successes
- **Unhealthy threshold**: 3 consecutive failures
- **Interval**: 30 seconds
- **Timeout**: 5 seconds

### Use Case 5: Monitoring Alert (Grafana/Datadog)

Create an alert when:
```
status != "ok" for > 5 minutes
```

---

## 🐛 Troubleshooting

### Problem: Health check returns 503

**Cause**: One or more services have `status: "error"`

**Solution**:
1. Check the response - it tells you which service failed
2. Look at backend logs for `[Health Check]` errors
3. Verify that service is running (database, Redis, etc.)
4. Check your `.env` file has correct configuration

**Example error response**:
```json
{
  "status": "degraded",
  "services": {
    "database": {
      "status": "error",
      "message": "Connection refused",
      "details": "Database connection failed"
    }
  }
}
```

### Problem: Database shows "not_configured"

**Cause**: `DATABASE_URL` not set in `.env`

**Solution**: Add to your `.env` file:
```env
DATABASE_URL="mysql://user:password@localhost:3306/database"
```

### Problem: Health check is slow (>1 second)

**Cause**: One of your service checks is taking too long

**Solution**:
1. Check the `responseTime` for each service in the response
2. Add a timeout to slow checks:
```javascript
const checkWithTimeout = (promise, ms) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    )
  ]);
};

// Use it:
await checkWithTimeout(prisma.$queryRaw`SELECT 1`, 3000); // 3s timeout
```

---

## 📊 Response Fields Explained

| Field | Type | Meaning |
|-------|------|---------|
| `status` | string | Overall health: `ok`, `degraded` |
| `timestamp` | string | When this check ran (ISO 8601) |
| `uptime` | number | How long the app has been running (seconds) |
| `environment` | string | `development` or `production` |
| `memory.rss` | number | Total memory used (MB) |
| `memory.heapUsed` | number | JavaScript heap memory used (MB) |
| `memory.heapTotal` | number | Total heap memory allocated (MB) |
| `services` | object | Status of each dependency |
| `responseTime` | string | How long the check took |

---

## 🎨 Best Practices

### ✅ DO:
- Add checks for all critical dependencies (database, cache, etc.)
- Use `not_configured` status for optional services during development
- Log errors with `[Health Check]` prefix for easy searching
- Keep checks fast (<100ms per service when healthy)
- Return 503 for actual errors, 200 for not_configured

### ❌ DON'T:
- Don't add checks for non-critical services to the main health check
- Don't forget to add timeouts for external service checks
- Don't expose sensitive info in error messages (passwords, tokens, etc.)
- Don't make health checks do expensive operations (complex queries, etc.)

---

## 🔗 Integration Examples

### Express App (Already Done)
```javascript
const healthRoutes = require('./features/health/health.routes');
app.use('/health', healthRoutes);
```

### Monitoring Script (Node.js)
```javascript
const checkHealth = async () => {
  try {
    const response = await fetch('http://localhost:8080/health');
    const data = await response.json();

    if (data.status !== 'ok') {
      console.error('⚠️ Service degraded:', data);
      // Send alert to Slack, PagerDuty, etc.
    }
  } catch (error) {
    console.error('❌ Health check failed:', error);
  }
};

// Run every minute
setInterval(checkHealth, 60000);
```

---

## 📁 File Structure

```
backend/src/features/health/
├── README.md           # This file - documentation
└── health.routes.js    # The actual health check endpoints
```

---

## 🆘 Need Help?

1. **Check the logs**: Search for `[Health Check]` in your logs
2. **Test manually**: Use `curl http://localhost:8080/health`
3. **Verify services**: Make sure database, Redis, etc. are actually running
4. **Check .env**: Ensure all required environment variables are set

---

## 📝 Quick Reference Card

**Need to know if the app is down?**
→ `GET /health/live` (if this fails, restart the app)

**Need to know if the app can handle traffic?**
→ `GET /health/ready` (if this fails, don't route traffic)

**Need detailed info on what's working/broken?**
→ `GET /health` (tells you everything)

**Need to add a new service check?**
→ Copy one of the examples above into `serviceChecks` object

---

Built with ❤️ for easy monitoring and debugging
