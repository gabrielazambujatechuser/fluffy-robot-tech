import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GoogleSignInButton } from '@/components/google-signin-button'
import { AuthToast } from '@/components/auth-toast'
import { Suspense } from 'react'

export default async function Home() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <AuthToast />
      <HomeContent />
    </Suspense>
  )
}

function HomeSkeleton() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-slate-900 text-white animate-pulse">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="h-12 w-1/2 mx-auto bg-slate-700 rounded-lg mb-8" />
        <div className="h-6 w-1/3 mx-auto bg-slate-800 rounded-lg mb-16" />
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div className="h-64 bg-slate-800/50 rounded-lg" />
          <div className="h-64 bg-slate-800/50 rounded-lg" />
        </div>
      </div>
    </main>
  )
}

async function HomeContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-slate-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="text-6xl mb-4">🔧</div>
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Inngest Fixer
          </h1>
          <p className="text-2xl text-slate-300 mb-8">
            AI-powered automatic fix for failed Inngest functions
          </p>
          <GoogleSignInButton />
        </div>

        {/* Problem/Solution */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-4 text-red-400">😫 The Problem</h2>
            <ul className="space-y-3 text-slate-300">
              <li>✗ Inngest function fails on bad payload</li>
              <li>✗ Manual inspection takes 10+ minutes</li>
              <li>✗ Guessing what field is missing</li>
              <li>✗ Manually editing JSON to replay</li>
              <li>✗ Multiple retry attempts before success</li>
            </ul>
          </div>

          <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-4 text-green-400">🎉 The Solution</h2>
            <ul className="space-y-3 text-slate-300">
              <li>✓ Automatic failure detection</li>
              <li>✓ AI analyzes error + payload</li>
              <li>✓ Suggests exact fix in seconds</li>
              <li>✓ One-click replay with fix</li>
              <li>✓ 95% success rate on first retry</li>
            </ul>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-slate-800/50 rounded-lg p-8 mb-16">
          <h2 className="text-3xl font-bold mb-8 text-center">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { num: 1, title: 'Failure Occurs', desc: 'Inngest function fails, webhook triggers' },
              { num: 2, title: 'AI Analyzes', desc: 'Claude reads error, payload, and code' },
              { num: 3, title: 'Fix Generated', desc: 'AI suggests corrected payload' },
              { num: 4, title: 'Replay', desc: 'One-click to retry with fix' },
            ].map((step) => (
              <div key={step.num} className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                  {step.num}
                </div>
                <h3 className="font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-slate-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        {/* <div className="text-center">
          <GoogleSignInButton />
          <p className="mt-4 text-slate-400">Free to use • No credit card required</p>
        </div> */}
      </div>
    </main>
  )
}