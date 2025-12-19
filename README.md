# 🔧 Inngest Fixer

Inngest Fixer is an AI-powered observability tool that automatically analyzes Inngest function failures. When a function fails, it uses Claude-3.5 Sonnet to perform a root-cause analysis and suggest a corrected JSON payload to fix the event.

![Dashboard Preview](https://github.com/starslingdev/fluffy-robot/blob/main/public/dashboard-preview.png?raw=true)

## 🚀 Features

- **Automated Failure Analysis**: Detects `function.failed` events via webhooks.
- **AI-Powered Fixes**: Uses Anthropic's Claude to suggest exactly what was wrong and how to fix the payload.
- **Project Multi-tenancy**: Manage multiple Inngest projects from a single dashboard.
- **Seamless Local Testing**: Includes a built-in simulation tool to test the entire flow without needing a public URL.

## 🛠️ How it Works

1.  **Failure Occurs**: An Inngest function fails (either in production or local dev).
2.  **Webhook Trigger**: Inngest Cloud sends a `function/failed` webhook to your app.
3.  **AI Analysis**: The app fetches the error details and the original event, then sends them to Claude for analysis.
4.  **Logging**: The analysis, root cause, and suggested fix are stored in a Supabase database.
5.  **Dashboard Display**: You view the failure details and the proposed fix on the dashboard.

## ⚙️ Setup

### 1. Database Configuration
Run the following SQL in your Supabase SQL Editor to create the necessary tables and RLS policies:

```sql
-- Projects Table
CREATE TABLE inngest_fixer_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  project_name TEXT NOT NULL,
  inngest_event_key TEXT NOT NULL,
  signing_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Failure Events Table
CREATE TABLE inngest_fixer_failure_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES inngest_fixer_projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  event_id TEXT NOT NULL,
  function_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  error_message TEXT,
  original_payload JSONB,
  fixed_payload JSONB,
  ai_analysis TEXT,
  fix_confidence TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE inngest_fixer_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE inngest_fixer_failure_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own projects" ON inngest_fixer_projects
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own failures" ON inngest_fixer_failure_events
  FOR ALL USING (auth.uid() = user_id);
```

### 2. Environment Variables
Create a `.env.local` file with the following:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic
ANTHROPIC_API_KEY=your_claude_api_key

# Inngest (for local testing)
INNGEST_EVENT_KEY=your_local_dev_key
INNGEST_SIGNING_KEY=your_signing_key
```

### 3. Installation & Run
```bash
pnpm install
pnpm dev
```

## 🧪 Testing

### Local Development Flow
1.  **Start Inngest Dev Server**: `npx inngest-cli@latest dev`.
2.  **Trigger a Failure**: Go to `/dashboard/test` in the app, select "Local Dev", and send a test event with "Include error" checked.
3.  **Simulate Webhook**: Since the local dev server doesn't send webhooks, click the **⚡ Simulate Cloud Webhook** button on your dashboard.
4.  **View Results**: Wait for the AI analysis to appear and click on the failure event.

### Production flow
For production, simply configure your Webhook URL in Inngest Cloud to point to your deployed app:
`https://fluffy-robot-tech.vercel.app/api/webhook/inngest?project_id=YOUR_PROJECT_ID`

---
Built with ❤️ by the StarSling team.
