# 🔧 Inngest Fixer

AI-powered failure analysis for Inngest functions. When your Inngest functions fail, Inngest Fixer automatically analyzes the error and generates prompts you can paste into your code IDE to fix issues instantly.

![Dashboard Preview](https://github.com/starslingdev/fluffy-robot/blob/main/public/dashboard-preview.png?raw=true)

## 🚀 Features

- **Zero-Code Setup**: Connect your Inngest Cloud directly - no code changes required
- **Automated Failure Detection**: Captures `function.failed` events automatically
- **AI-Powered Analysis**: Uses Claude to identify root causes and suggest fixes
- **IDE-Ready Prompts**: Get detailed analysis you can paste into your code editor
- **Multi-Project Support**: Manage multiple Inngest projects from one dashboard

## 🎯 How It Works

1. **Failure Detected**: Your Inngest function fails in production or development
2. **AI Analyzes**: Claude reads the error, payload, and identifies the issue
3. **Fix Generated**: AI creates detailed analysis and corrected payload
4. **Copy & Paste**: Use the AI prompt in your code IDE to fix instantly

## 📋 Quick Start

### 1. Sign Up
Visit [fluffy-robot-tech.vercel.app](https://fluffy-robot-tech.vercel.app) and sign in with Google.

### 2. Create a Project
1. Click **"+ Add Project"** in your dashboard
2. Enter your project name
3. Add your **Inngest Event Key** (from Inngest Cloud → Settings → API Keys)
4. (Optional) Add your **Webhook Signing Key** for secure verification

### 3. Connect to Inngest Cloud

**Option A: Zero-Code Setup (Recommended)**
1. Go to your project's detail page
2. Copy the **Inngest App URL** shown in the "Connect as Inngest App" section
3. In **Inngest Cloud**, go to **Apps → Connect New App**
4. Paste the URL and connect
5. Done! Failures will now be automatically analyzed

**Option B: Webhook Setup**
1. Copy the **Webhook URL** from your project settings
2. In **Inngest Cloud**, go to **Settings → Webhooks**
3. Add the webhook URL
4. Enable the `function.failed` event

### 4. Test It Out
1. Click **"Test Events"** in the dashboard navigation
2. Select a test scenario (e.g., "Missing Payment Amount")
3. Click **"Send Event"**
4. View the AI analysis in your dashboard

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- pnpm
- Supabase account
- Anthropic API key

### Database Setup
Run this SQL in your Supabase SQL Editor:

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

### Environment Variables
Create a `.env.local` file:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic
ANTHROPIC_API_KEY=your_claude_api_key

# Inngest
INNGEST_EVENT_KEY=your_inngest_event_key
INNGEST_SIGNING_KEY=your_signing_key

# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional: For local testing
INNGEST_FIXER_PROJECT_ID=your_test_project_id
```

### Installation
```bash
pnpm install
pnpm dev
```

Visit `http://localhost:3000` to see the app.

## 🧪 Testing

### Using the Test Page
1. Navigate to `/dashboard/test`
2. Choose a test scenario:
   - **Missing User Email**: Tests validation for missing required fields
   - **Missing Payment Amount**: Tests payment validation
3. Click **"Send Event"** to trigger a test failure
4. View the AI analysis in your dashboard

### Local Inngest Development
1. Start Inngest Dev Server: `npx inngest-cli@latest dev`
2. Your app will connect to `http://localhost:8288`
3. Trigger test events from `/dashboard/test`
4. View failures and AI analysis in real-time

## 📚 Usage Guide

### Viewing Failures
- **Dashboard**: See all recent failures with status badges
- **Click any failure**: View detailed AI analysis, error message, and corrected payload
- **Status indicators**:
  - 🟡 **Pending**: Analysis in progress
  - 🟢 **Fixed**: AI successfully generated a fix
  - 🔴 **Failed**: Analysis encountered an error

### Understanding AI Analysis
Each failure includes:
- **Analysis**: What went wrong and why
- **Root Cause**: The underlying issue
- **Confidence Level**: AI's confidence in the fix (low/medium/high)
- **Corrected Payload**: The fixed JSON you can use

### Using the Fixes
1. Copy the AI analysis or corrected payload
2. Paste into your code IDE or AI assistant
3. Apply the suggested changes to your code
4. Test the fix in your development environment

## 🔒 Security

- **RLS Policies**: All data is protected by Supabase Row Level Security
- **Webhook Verification**: Optional HMAC signature verification for webhooks
- **Service Role**: Background jobs use service role for database access
- **Google OAuth**: Secure authentication via Google Sign-In

## 🏗️ Architecture

```
Inngest Cloud → Inngest App URL → Native Handler → Fixer Service
                                                   ↓
                                              Supabase + Claude AI
                                                   ↓
                                              Dashboard UI
```

## 📝 Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key |
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API key for Claude |
| `INNGEST_EVENT_KEY` | ✅ | Inngest event key |
| `INNGEST_SIGNING_KEY` | ✅ | Inngest signing key |
| `NEXT_PUBLIC_SITE_URL` | ✅ | Your deployed site URL |
| `INNGEST_FIXER_PROJECT_ID` | ⚪ | Default project for local testing |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT

---

Built with ❤️ by the StarSling team.
