# StandupSync — Smart Standup Report Generator

A serverless app that generates structured daily standup reports and weekly sprint summaries for dev teams. Built for the AWS Weekend Annoying Task Challenge.

## Architecture

```
┌──────────────────────┐
│   S3 Static Hosting  │   HTML/CSS/JS frontend
└──────────┬───────────┘
           │ HTTPS
           ▼
┌──────────────────────┐
│    API Gateway       │   HTTP API routes
│  (standup-sync-api)  │   POST /reports, GET /reports/{id}
│                      │   GET /reports, POST /weekly-summary
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│    AWS Lambda        │   Python 3.12
│ (standup-sync-gen)   │   Report generation + smart categorization
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Amazon DynamoDB      │
│ standup-reports      │   Report storage
└──────────────────────┘
```

## AWS Services Used

| Service | Purpose |
|---------|---------|
| Amazon S3 | Static website hosting for the frontend |
| AWS Lambda | Serverless compute — report generation logic |
| Amazon API Gateway (HTTP API) | REST API endpoints |
| Amazon DynamoDB | NoSQL database for report storage |

## Quick Start

### 1. Create DynamoDB Table

1. DynamoDB → Create table
2. Table name: `standup-reports`
3. Partition key: `id` (String)
4. Use default settings (on-demand capacity)
5. Create

### 2. Create IAM Role for Lambda

1. IAM → Roles → Create role
2. Trusted entity: AWS service → Lambda
3. Add inline policy (see below)
4. Name: `StandupSyncLambdaRole`

**Inline policy JSON:**

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "DynamoDBAccess",
            "Effect": "Allow",
            "Action": [
                "dynamodb:PutItem",
                "dynamodb:GetItem",
                "dynamodb:Scan",
                "dynamodb:DeleteItem",
                "dynamodb:Query"
            ],
            "Resource": "arn:aws:dynamodb:us-east-1:*:table/standup-reports"
        },
        {
            "Sid": "CloudWatchLogs",
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:us-east-1:*:log-group:/aws/lambda/*:*"
        }
    ]
}
```

### 4. Create Lambda Function

1. Lambda → Create function → Author from scratch
2. Name: `standup-sync-generator`
3. Runtime: Python 3.12
4. Architecture: x86_64
5. Execution role: `StandupSyncLambdaRole` (existing role)
6. Copy the code from `backend/lambda_function.py` into the code editor
7. Click **Deploy**
8. Go to Configuration → General configuration → Timeout: **30 seconds**

### 5. Create API Gateway

1. API Gateway → Create API → HTTP API → Build
2. API name: `standup-sync-api`
3. Configure routes:
   - `POST /reports`
   - `GET /reports`
   - `GET /reports/{id}`
   - `POST /weekly-summary`
4. Attach integration to Lambda `standup-sync-generator`
5. Stage: `$default` (auto-deploy)
6. Copy the **Invoke URL**

### 6. Deploy Frontend via S3

1. S3 → Create bucket → name: `standup-sync-frontend-YOURNAME`
2. Uncheck "Block all public access" (acknowledge)
3. Go to bucket → Properties → **Static website hosting** → Enable
4. Index document: `index.html` → Save
5. Go to bucket → Permissions → **Bucket Policy** → paste:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::standup-sync-frontend-YOURNAME/*"
        }
    ]
}
```

6. Build the frontend locally:
```bash
cd frontend
npm install
npm run build
```

7. Upload the entire `dist/` folder to the S3 bucket
8. Open the **Static website hosting URL** from Properties tab

### 7. Configure Frontend

Before building, open `frontend/src/App.tsx` and update the `API_BASE` constant with your API Gateway URL:

```ts
const API_BASE = "https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com";
```

Or set the `VITE_API_URL` environment variable in Amplify.

## API Endpoints

### Generate Standup Report
```
POST /reports
Content-Type: application/json

{
  "yesterdayTasks": ["Fixed login bug", "Code review PR #342"],
  "todayPlan": ["Deploy v2.3 to staging", "Write integration tests"],
  "blockers": ["Waiting on DevOps to provision staging DB"],
  "teamContext": "Backend API team working on payment service",
  "userId": "john-dev"
}
```

### List All Reports
```
GET /reports?limit=20
```

### Get Specific Report
```
GET /reports/{reportId}
```

### Generate Weekly Summary
```
POST /weekly-summary
Content-Type: application/json

{
  "reportIds": ["uuid-1", "uuid-2", "uuid-3", "uuid-4", "uuid-5"],
  "userId": "john-dev"
}
```

## Local Development

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_URL` in `.env` pointing to your API Gateway URL.

## Technologies

- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Python 3.12, AWS Lambda
- **Database**: Amazon DynamoDB
- **Hosting**: Amazon S3, API Gateway