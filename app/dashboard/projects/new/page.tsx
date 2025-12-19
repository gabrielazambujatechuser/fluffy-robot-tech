'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'

export default function NewProjectPage() {
    const [projectName, setProjectName] = useState('')
    const [signingKey, setSigningKey] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const { error } = await supabase
                .from('inngest_fixer_projects')
                .insert({
                    project_name: projectName,
                    signing_key: signingKey,
                    user_id: user.id
                })

            if (error) throw error

            toast.success('Project created successfully!')
            router.push('/dashboard')
            router.refresh()
        } catch (error: any) {
            toast.error(error.message || 'Failed to create project')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            <div className="max-w-2xl mx-auto">
                <Link href="/dashboard" className="text-blue-400 hover:text-blue-300 mb-8 inline-block">
                    ← Back to Dashboard
                </Link>

                <h1 className="text-3xl font-bold mb-8">Add New Inngest Project</h1>

                <div className="bg-slate-800 rounded-lg p-6 mb-8 shadow-xl border border-slate-700">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="projectName" className="block text-sm font-medium mb-2">
                                Project Name
                            </label>
                            <input
                                id="projectName"
                                type="text"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                placeholder="e.g. My Next.js App"
                                required
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-600"
                            />
                        </div>

                        <div>
                            <label htmlFor="signingKey" className="block text-sm font-medium mb-2 flex items-center gap-2">
                                Webhook Signing Key
                                <span className="text-xs text-slate-500 font-normal">(Optional for local dev)</span>
                            </label>
                            <input
                                id="signingKey"
                                type="password"
                                value={signingKey}
                                onChange={(e) => setSigningKey(e.target.value)}
                                placeholder="sign-key-..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-600 font-mono text-sm"
                            />
                            <p className="mt-2 text-xs text-slate-500">
                                Providing your signing key enables secure webhook verification.
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !projectName}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                        >
                            {isLoading ? 'Creating...' : 'Create Project'}
                        </button>
                    </form>
                </div>

                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4 text-blue-400 flex items-center gap-2">
                        <span>ℹ️</span> How to Setup Webhooks
                    </h2>
                    <p className="text-slate-300 mb-4">
                        To enable AI-powered fixes, you need to configure an Inngest failure webhook in your project's settings.
                    </p>
                    <ol className="list-decimal list-inside space-y-3 text-slate-300">
                        <li>Go to your Inngest Cloud dashboard.</li>
                        <li>Select your app and navigate to <strong>Settings → Webhooks</strong>.</li>
                        <li>Click <strong>Add Webhook</strong>.</li>
                        <li>Set the URL to:
                            <code className="block bg-slate-900 p-2 mt-2 rounded border border-slate-700 text-blue-400">
                                {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhook/inngest
                            </code>
                        </li>
                        <li>Select the event <code>function.failed</code>.</li>
                        <li>Save the webhook.</li>
                    </ol>
                </div>
            </div>
        </div>
    )
}
