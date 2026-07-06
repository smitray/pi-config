# API Reference

Welcome to the complete API reference for the DataSync service. This document covers all available endpoints, authentication, error handling, and rate limiting.

## Authentication

All API requests require authentication via Bearer token. Include the token in the Authorization header:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" https://api.example.com/v1/users
```

Tokens are scoped to specific resources and expire after 24 hours. Use the refresh endpoint to obtain a new token without re-authenticating.

### Token Refresh

```
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "client_id": "your-client-id"
}
```

Response:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 86400,
  "token_type": "Bearer"
}
```

## Users

The Users resource represents registered accounts in the system.

### List Users

```
GET /v1/users
```

Query parameters:
- `limit` — number of results per page (default: 20, max: 100)
- `offset` — pagination offset
- `sort` — field to sort by (created_at, name, email)
- `order` — asc or desc (default: desc)

Response:

```json
{
  "data": [
    {
      "id": "usr_abc123",
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "created_at": "2026-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```

### Create User

```
POST /v1/users
Content-Type: application/json

{
  "name": "Bob Smith",
  "email": "bob@example.com",
  "role": "admin"
}
```

Validation rules:
- `name` must be 2-100 characters
- `email` must be valid email format
- `role` must be one of: admin, editor, viewer

### Get User

```
GET /v1/users/:id
```

### Update User

```
PATCH /v1/users/:id
Content-Type: application/json

{
  "name": "Robert Smith",
  "role": "editor"
}
```

### Delete User

```
DELETE /v1/users/:id
```

Returns 204 No Content on success. Soft-deletes the user (data retained for 30 days).

## Organizations

Organizations group users and resources together.

### List Organizations

```
GET /v1/organizations
```

### Create Organization

```
POST /v1/organizations
Content-Type: application/json

{
  "name": "Acme Corp",
  "plan": "enterprise",
  "billing_email": "billing@acme.com"
}
```

### Organization Members

```
GET /v1/organizations/:id/members
POST /v1/organizations/:id/members
DELETE /v1/organizations/:id/members/:user_id
```

## Rate Limiting

Requests are limited per API key:
- **Free tier:** 100 requests/minute
- **Pro tier:** 1000 requests/minute
- **Enterprise:** custom limits

Rate limit headers are included in every response:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067200
```

When rate limited, the API returns 429 Too Many Requests with a Retry-After header.

## Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": [
      {
        "field": "email",
        "issue": "must be a valid email address"
      }
    ]
  }
}
```

Common error codes:
- `400` — Bad Request (validation error)
- `401` — Unauthorized (missing or invalid token)
- `403` — Forbidden (insufficient permissions)
- `404` — Not Found
- `429` — Too Many Requests (rate limited)
- `500` — Internal Server Error

## Webhooks

Configure webhooks to receive real-time notifications for events.

### Register Webhook

```
POST /v1/webhooks
Content-Type: application/json

{
  "url": "https://your-app.com/webhook",
  "events": ["user.created", "user.updated", "organization.created"],
  "secret": "whsec_your_signing_secret"
}
```

### Verify Webhook Signatures

All webhook payloads include a `X-Webhook-Signature` header. Verify using HMAC-SHA256:

```python
import hmac
import hashlib

def verify_signature(payload, signature, secret):
    expected = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)
```
