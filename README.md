# CareerMate API

Backend API for **CareerMate**. It handles account authentication, resume files, and user profiles.

Built with Express 5 and MongoDB (Mongoose). Files are stored in Amazon S3.

The frontend lives in a separate repository: https://github.com/skylar-he-au/careermate-web

## Tech stack

| Area | Library |
| --- | --- |
| HTTP server | Express 5, helmet, cors, express-rate-limit |
| Database | MongoDB via Mongoose 9 |
| Auth | jsonwebtoken (JWT, HS256), bcryptjs |
| Validation | zod 4 |
| File storage | AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`) |
| Logging | winston (console transport), morgan (HTTP access log) |
| Tests | Jest 30, supertest |
| Deployment config | AWS Elastic Beanstalk (`Procfile`, `.elasticbeanstalk/config.yml`). Not deployed yet, see [Deployment](#deployment) |

## Getting started

### Prerequisites

- Node.js **20.19 or later**. Mongoose 9 requires it. `package.json` does not declare an `engines` field.
- A reachable MongoDB instance. The server connects before it starts listening, and it exits if the connection errors.
- An S3 bucket, plus AWS credentials that can `PutObject`, `GetObject`, `DeleteObject` and `HeadObject` on it.
  `CopyObject` needs read access on the source key and write access on the destination key.
- For browser uploads, the bucket's CORS configuration must allow `PUT` from the frontend origin. This is not managed by this repo.

### Run locally

```bash
npm install
cp .env.example .env   # then fill in the values
npm run dev            # nodemon, NODE_ENV=development
```

The server listens on `PORT` (default `3000`). `GET /health` returns `{ "status": "ok" }`.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start with nodemon, `NODE_ENV=development` |
| `npm start` | Start with `NODE_ENV=production` (this is what the `Procfile` runs) |
| `npm run debug` | Start with `node --inspect` |
| `npm test` | Run all Jest suites |
| `npm run test:unit` / `npm run test:integration` | Run one test folder |
| `npm run test:coverage` | Run tests with coverage and enforce the thresholds in `jest.config.js` |

### Environment variables

All variables are read in [`src/utils/config.js`](src/utils/config.js) unless noted otherwise. A template is in [`.env.example`](.env.example).

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `DB_CONNECTION_STRING` | yes | – | MongoDB connection URI |
| `JWT_KEY` | yes | – | Secret used to sign and verify JWTs |
| `S3_BUCKET` | yes | – | Bucket for temporary uploads, resumes and avatars |
| `PORT` | no | `3000` | On Elastic Beanstalk the platform sets this |
| `NODE_ENV` | no | `development` | Set by the npm scripts. Rate limiting only runs when this is `production` |
| `LOG_LEVEL` | no | `info` | winston log level |
| `AWS_REGION` | no | `ap-southeast-2` | Region for the S3 client |
| `CLOUDFRONT_DOMAIN` | no | – | Domain used to build `avatarUrl`. Without it, `avatarUrl` is `null` |
| `RATE_LIMIT_WINDOW_MS` | no | `900000` (15 min) | See Known limits: setting it through env currently fails validation |
| `RATE_LIMIT_LIMIT` | no | `100` | Requests per window per IP |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | local only | – | **Not** read by `config.js`. The AWS SDK default credential chain picks them up. When running on AWS, prefer an instance profile role |

If `DB_CONNECTION_STRING`, `JWT_KEY` or `S3_BUCKET` is missing, the app throws at startup.

## API overview

All `/v1` routes except `/v1/auth/*` and `/v1/public` require `Authorization: Bearer <token>`.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/`, `/health` | Liveness check (does not check the database) |
| `POST` | `/v1/auth/register` | `fullName`, `email`, `password` |
| `POST` | `/v1/auth/login` | Returns `{ user, token }` |
| `POST` | `/v1/auth/forgot-password` | Stores a 6-digit reset code on the user |
| `POST` | `/v1/auth/verify-code` | Exchanges the code for a `resetToken` |
| `POST` | `/v1/auth/reset-password` | `email`, `resetToken`, `newPassword` |
| `GET` / `PUT` | `/v1/users/me` | Read or update the profile (`fullName`, `displayName`, `role`, `field`, `goal`) |
| `PUT` | `/v1/users/me/password` | `currentPassword`, `newPassword` |
| `POST` | `/v1/users/me/avatar` | Register an uploaded avatar (`fileKey`) |
| `DELETE` | `/v1/users/:id` | Admin only. Soft delete |
| `POST` | `/v1/users/:id/restore` | Admin only |
| `POST` | `/v1/upload/presigned-url` | `fileName`, `contentType`, `category` (`avatar` \| `resume`), `fileSize` |
| `POST` | `/v1/resumes` | Register an uploaded resume (`fileKey`, `fileName`) |
| `GET` | `/v1/resumes?page=&limit=` | Resumes of the current user, newest first |
| `GET` | `/v1/resumes/:id/download` | Presigned GET URL, valid for 1 hour |
| `DELETE` | `/v1/resumes/:id` | Deletes the S3 object and the record |
| `GET` | `/v1/public`, `/v1/private`, `/v1/admin` | Demo routes for the auth and role guards |

## Project structure

```
src/
  app.js, index.js      Express app and server bootstrap (graceful shutdown on SIGTERM/SIGINT)
  controllers/          *.controller.js – request handlers
  routes/               *.routes.js + v1.js – routers
  middleware/           auth guard, role guard, validation, rate limit, morgan, error handler
  exceptions/           AppException and HTTP-specific subclasses
  models/               Mongoose models (User, Resume)
  validation/           zod schemas
  utils/                config, db, jwt, logger, password, s3
tests/
  unit/                 controllers, S3 helpers, models, validation schemas
  integration/          HTTP tests through the Express app with supertest
```

## Design notes

### Ownership checks: one function, identity only from the JWT

`findOwnResume(resumeId, userId)` in [`src/controllers/resume.controller.js`](src/controllers/resume.controller.js) is the only resume ownership check.
It loads the resume. It throws `NotFoundException` (404) if the resume does not exist, and `ForbiddenException` (403) if `resume.user` is not the caller.
Both `downloadResume` and `deleteResume` call it, so the two endpoints cannot drift apart.

The caller's id always comes from `req.user.id`. `authGuard-middleware.js` sets `req.user` after verifying the JWT.
No endpoint reads a user id from the body or query string: `createResume`, `getResumes`, `/users/me` and the upload URL all scope by `req.user.id`.
The admin routes `/v1/users/:id` take a target id from the path, but only after `roleGuard('admin')`.

### Two-phase uploads

The client uploads directly to S3, never through the API. Files only move to a permanent location after the server validates them.

1. **Request an upload URL.** `POST /v1/upload/presigned-url` checks `contentType` and `fileSize` against the category limits:
   resumes accept `application/pdf` up to 10 MB, avatars accept JPEG, PNG or WebP up to 5 MB.
   The server generates the key as `tmp/{userId}/{uuid}{ext}`. The client's file name is never part of the key.
   The server then returns a presigned `PUT` URL. The URL is valid for 5 minutes and signs `content-type` and `content-length`.
2. **Upload** the file to S3 with that URL.
3. **Register the file.** Call `POST /v1/resumes` or `POST /v1/users/me/avatar` with the `fileKey`. The server then:
   - validates the key shape with zod (`TMP_KEY_PATTERN`: `tmp/<24-hex>/<name>`);
   - checks that the key starts with `tmp/${req.user.id}/`, and throws 403 before touching S3 if it does not;
   - calls `HeadObject` to confirm the object exists and to recheck its content type and size;
   - copies it to `resume/{userId}/…` or `avatar/{userId}/…` and deletes the temporary object;
   - writes the `Resume` record, or updates `user.avatar`. For avatars, the previous avatar object is then deleted on a best-effort basis.

The prefix check matters because temporary keys are not secret: they come back in API responses and can show up in logs.
Without the check, a user could register another user's pending upload as their own file.

### Password hashing

Passwords are hashed with **bcryptjs**, a pure-JavaScript bcrypt implementation, with `SALT_ROUNDS = 12` ([`src/utils/password.js`](src/utils/password.js)).
The user record also stores the most recent hashes (`MAX_PASSWORD_HISTORY = 2`).
A password change or reset is rejected if the new password matches one of them.
`password`, `passwordHistory`, `accountType` and `__v` are removed from every JSON response by the model's `toJSON` transform.

### Exceptions and centralised error handling

[`src/exceptions/app.exception.js`](src/exceptions/app.exception.js) defines `AppException(status, message, context)`. Each subclass fixes the HTTP status:

| Exception | Status |
| --- | --- |
| `BadRequestException`, `ValidationException` | 400 |
| `UnauthorizedException` | 401 |
| `ForbiddenException` | 403 |
| `NotFoundException` | 404 |
| `ConflictException` | 409 |

Controllers and middleware just `throw`. Express 5 forwards rejected promises from async handlers to the error middleware, so there are no `try/catch` wrappers.

[`src/middleware/error/error.middleware.js`](src/middleware/error/error.middleware.js) is registered last in `app.js`. It works as follows:

- status is `err.status`, or 500 if missing;
- **5xx**: `logger.error` with the request method, URL, error name and **stack**;
- **4xx**: `logger.info` with the message, method and URL only, so client mistakes do not flood the error log;
- the response is always `{ "success": false, "error": { "message": "..." } }`. The stack trace is **never** sent to the client.

## Testing

```bash
npm test
```

There are 8 suites and 52 tests. None of them need a running MongoDB or AWS: `tests/setup-env.js` sets dummy env vars, and Mongoose models and S3 are mocked.

**Unit tests** (`tests/unit`):
- `auth.controller`: register, login (including rejection cases), forgot password, verify code, reset password with password history.
- `resume.controller`: create (including rejecting another user's temp key), pagination, download, delete.
- `upload.controller`: key format, type and size limits.
- `avatar.controller`: `updateAvatar` move, old-avatar cleanup, rejecting another user's temp key.
- `s3`: presigned URL parameters, copy-source encoding, 404 mapping, type and size checks (AWS SDK mocked).
- `models`: required fields, the `toJSON` field stripping, the `avatarUrl` getter (via `validate()`, no DB connection).
- `validation`: upload schema and temp-key pattern.

**Integration tests** (`tests/integration/api.test.js`) run through the real Express app with supertest, including routing, helmet, the auth guard, zod validation and the error handler.
Models, S3, password hashing and the logger are mocked.

**Coverage** (`npm run test:coverage`): about 84% statements, 59% branches, 67% functions and 84% lines. The thresholds in `jest.config.js` are 65 / 35 / 50 / 65.

**Gaps:**
- `user.controller.js` is only about 41% covered. `getMe`, `updateMe`, `updateMyPassword`, `deleteUser` and `restoreUser` have no tests.
- The role guard, the rate limiters, `db.js` and the 5xx branch of the error handler are not exercised.
- Nothing runs against a real MongoDB or S3 (for example with mongodb-memory-server or LocalStack). Mongoose query behaviour, unique indexes and real S3 permissions are untested.
- There is no CI configuration in the repo, so tests only run when someone runs them locally.

## Deployment

**Status: not deployed.** The repo includes deployment configuration for AWS Elastic Beanstalk, but there is currently no live environment running this API.

### What the repo contains

- `Procfile`: `web: npm start`. `npm start` sets `NODE_ENV=production`, which enables the rate limiters and the `combined` morgan format.
- `.elasticbeanstalk/config.yml`: only `global.profile: null`. No application name, environment name or region is committed.

### Before a first deployment

- **Check startup on Linux.** Until commit `5f2e913`, `src/routes/v1.js` and `src/routes/user.routes.js` imported `roleGuard-Middleware`, but the file is named `roleGuard-middleware.js`.
  macOS resolves that anyway. A case-sensitive filesystem such as Linux fails at startup with `MODULE_NOT_FOUND`.
  The import is fixed, but the fix has not been verified on Linux yet, so start the app in a Linux environment (for example a Docker container) first.
- **Pass the required variables when you create the environment.** `config.js` throws at startup if `DB_CONNECTION_STRING`, `JWT_KEY` or `S3_BUCKET` is missing, so without them the first deploy will not start.
- **Grant S3 access through the instance profile.** Give the instance profile role access to the S3 bucket instead of setting `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`.
- **Allow browser uploads.** The bucket's CORS configuration must allow `PUT` from the frontend origin.

### Deploying with the EB CLI

```bash
eb init
```

Choose the Node.js platform (Node.js 20.19 or later) and a region. The S3 client defaults to `ap-southeast-2`.

```bash
eb create <environment-name> --envvars DB_CONNECTION_STRING=...,JWT_KEY=...,S3_BUCKET=...
```

After the environment exists:

- Change variables with `eb setenv KEY=value …`. The platform sets `PORT` itself.
- Point the environment health check at `/health`.
- Ship later updates with `eb deploy`.
- `app.set('trust proxy', 1)` trusts exactly one proxy hop. That is correct behind the EB nginx proxy on a single instance. Re-check it if a load balancer is added (see Known limits).
- Logs go to stdout only, so on Elastic Beanstalk they end up in the instance logs (`web.stdout.log`).

## Known limits

### Authentication and sessions

- **No refresh tokens.** Login issues one JWT that expires after 7 days (`src/utils/jwt.js`). After that, every request gets a 401 and the user has to log in again. There is no refresh endpoint.
- **Tokens cannot be revoked.** The auth guard only verifies the signature and expiry. It never checks the database, so:
  - a soft-deleted user keeps full access until the token expires;
  - changing or resetting a password does not invalidate existing tokens;
  - there is no server-side logout.
- **The role comes from the token.** `roleGuard` reads `accountType` from the JWT payload, so promoting or demoting an admin takes effect only after a new login, up to 7 days later.
- **Password reset never sends anything.** `forgotPassword` saves the code on the user and replies "verification code has been sent", but there is no email or SMS integration yet.
- **Weak reset secrets.**
  - The reset code comes from `Math.random()`, which is not a cryptographically secure generator.
  - Both the code and the `resetToken` are stored in plaintext.
  - `verify-code` has no per-account attempt limit. The only protection is the IP rate limiter, which is disabled outside production.
- **Account enumeration.**
  - `forgot-password` returns different messages for known and unknown emails.
  - `login` returns different messages for an unknown email ("Email and Password mismatch") and a wrong password ("Invalid email ro password", typo included).
- **Login validates the password policy.** `loginSchema` reuses the registration password rules, so a user whose stored password predates the policy cannot log in.
- `login` responds with `201` instead of `200`.

### Error handling

- **5xx responses expose the raw error message.** The stack is never sent, but `err.message` is, so unexpected errors reach the client with internal wording.
  - A malformed id such as `/v1/resumes/abc/download` throws a Mongoose `CastError` and returns **500** instead of 400 or 404.
  - Two concurrent registrations with the same email can hit the unique index. The second returns a 500 with the MongoDB duplicate-key message instead of a 409.
- `AppException.context` is attached to errors but never logged, so it is currently lost.

### Files and storage

- **S3 and database writes are not atomic.**
  - `createResume` and `updateAvatar` copy, delete the temp object, then write to MongoDB. If the database write fails, the copied object is orphaned.
  - `deleteResume` deletes from S3 before MongoDB. If the database delete fails, the record points to a missing file.
- **Abandoned uploads are never cleaned up.** A presigned upload that is never registered stays under `tmp/` forever unless the bucket has a lifecycle rule. None is defined in this repo.
- **File type checks trust metadata.** The check relies on the S3 `ContentType` the client declared at upload, which is bound by the signature. There is no content sniffing or malware scanning.
- **Presigned URLs cannot be revoked.** A download URL stays valid for its full hour, even if the resume is deleted, until the object itself is gone.
- **`avatarUrl` is never in API responses.** The virtual exists, but the schema's `toJSON` option does not set `virtuals: true`. The top-level `virtuals: true` in the schema options does not do that.
  Responses only contain the raw `avatar` S3 key. Avatars also assume a public CloudFront distribution in front of the bucket.
- **Unbounded pagination.** `GET /v1/resumes` has no upper bound on `limit`. A negative `page` produces a negative `skip`.
  The driver only checks that `skip` is an integer, so the value reaches MongoDB. The server is expected to reject it and the request to fail with a 500. This path has no test.

### Users

- **Soft delete is partial.**
  - `deleteUser` only sets `deletedAt`. The user's resumes and avatar stay in S3 and MongoDB.
  - `/users/me` endpoints do not check `deletedAt`.
  - The email stays taken, so the person cannot register again.
- Profile enums are narrow: `role` is `Student` or `Other`, and `field` is `FE` or `BE`.

### Operations and configuration

- **Numeric env vars are not cast.** `config.js` passes `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_LIMIT` through as strings when they are set.
  express-rate-limit rejects a string `windowMs` (`ERR_ERL_WINDOW_MS`). Leave them unset until `config.js` casts them.
- **Rate limiting is basic.**
  - It only runs when `NODE_ENV=production`.
  - It uses the default in-memory store, so counters are per instance, reset on restart, and would not be shared across multiple instances.
  - Limits are per IP, not per user.
- **Proxy trust is fixed at one hop.** `trust proxy` is `1`. If the app is deployed behind a load balancer and the EB nginx proxy, there are two hops, and `req.ip` may be the load balancer's address. All clients would then share one rate-limit bucket.
- **CORS is open.** `cors()` runs with its defaults, which allow every origin.
- **Demo routes are not gated by environment.** `/v1/public`, `/v1/private` and `/v1/admin` are mounted whatever `NODE_ENV` is, so they would ship with any production deployment.
- **No API docs are served.** `src/utils/swagger.js` configures swagger-jsdoc (still titled "Movie API"), but nothing mounts it. `swagger-ui-express` is an unused dependency, and the controllers have no JSDoc annotations.
- **`/health` does not check MongoDB or S3.**
- **Logging.** Logs go to the console only. `logger.js` computes a `logs/` directory but never uses it.
- **Portability.** `npm start` and `npm run dev` use POSIX `NODE_ENV=… node` syntax, which does not work in Windows `cmd`. `package.json` has no `engines` field.
- **Mixed file naming.** Controllers and routes now use the dot style. `src/middleware` (for example `authGuard-middleware.js` next to `upload.middleware.js`) and `src/models` (`user-model.js` next to `resume.model.js`) still mix styles.
  Because macOS is case-insensitive, check import paths on Linux or in CI before deploying.
- **Unused imports.**
  - `const { success } = require('zod')` in `auth.controller.js` and `user.controller.js`
  - `string` from zod and `bcryptjs` in `user-model.js`
  - `validate` in `resume.routes.js`
  - `logger` and `connectToDb` in `app.js`
