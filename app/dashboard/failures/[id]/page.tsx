import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

export default async function FailureDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/')
    }

    const { data: failure } = await supabase
        .from('inngest_fixer_failure_events')
        .select(`
            *,
            project:inngest_fixer_projects(project_name)
        `)
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

    if (!failure) {
        notFound()
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            <div className="max-w-4xl mx-auto">
                <nav className="mb-8 flex items-center justify-between">
                    <Link href="/dashboard" className="text-blue-400 hover:text-blue-300 transition-colors">
                        ← Back to Dashboard
                    </Link>
                    <div className="flex items-center gap-3">
                        <span className="text-slate-500 text-sm">Status:</span>
                        <StatusBadge status={failure.status} />
                    </div>
                </nav>

                <div className="mb-8">
                    <h1 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-2">Failure Analysis</h1>
                    <h2 className="text-3xl font-bold mb-4">{failure.function_id}</h2>
                    <p className="text-slate-400">
                        In project <span className="text-white font-medium">{failure.project.project_name}</span> •
                        Detected {new Date(failure.created_at).toLocaleString()}
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Analysis */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* AI Fix Section */}
                        <section className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center">
                                <h3 className="font-bold flex items-center gap-2">
                                    <span>🤖</span> AI Proposed Fix
                                </h3>
                                <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full border border-white/20">
                                    <span className="text-xs font-semibold uppercase opacity-80">Confidence:</span>
                                    <ConfidenceBadge level={failure.fix_confidence} />
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="prose prose-invert max-w-none mb-8">
                                    {failure.ai_analysis ? (
                                        <div className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                                            {failure.ai_analysis}
                                        </div>
                                    ) : (
                                        <p className="text-slate-500 italic text-center py-8">No AI analysis available for this event.</p>
                                    )}
                                </div>

                                {failure.fixed_payload && (
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-400 uppercase mb-4">Corrected JSON Payload</h4>
                                        <div className="relative group">
                                            <pre className="bg-slate-950 p-6 rounded-xl border border-slate-700 font-mono text-sm overflow-auto max-h-[400px]">
                                                {JSON.stringify(failure.fixed_payload, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Error Message */}
                        <section className="bg-red-900/10 border border-red-500/20 rounded-2xl p-6">
                            <h3 className="text-red-400 font-bold mb-3 flex items-center gap-2 text-sm uppercase">
                                <span>⚠️</span> Error Details
                            </h3>
                            <p className="text-white font-mono text-sm bg-red-900/20 p-4 rounded-lg border border-red-500/10 break-all leading-relaxed">
                                {failure.error_message}
                            </p>
                        </section>
                    </div>

                    {/* Right Column: Meta Info */}
                    <div className="space-y-6">
                        <section className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl">
                            <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Event Context</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Inngest Run ID</label>
                                    <code className="text-xs bg-slate-900 px-2 py-1 rounded border border-slate-700 block truncate">{failure.run_id}</code>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Event Name</label>
                                    <code className="text-xs bg-slate-900 px-2 py-1 rounded border border-slate-700 block truncate">{failure.original_payload.name}</code>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Detection Time</label>
                                    <p className="text-sm text-slate-200">{new Date(failure.created_at).toLocaleString()}</p>
                                </div>
                            </div>
                        </section>

                        <section className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl">
                            <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Actions</h3>
                            <div className="grid grid-cols-1 gap-3">
                                <button
                                    disabled
                                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold py-3 rounded-lg transition-all"
                                >
                                    Replay with Fix 🔁
                                </button>
                                <button
                                    className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold py-3 rounded-lg transition-all"
                                >
                                    Copy Fixed JSON
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-4 text-center">
                                * Replay with fix is coming soon
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    const styles = {
        pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
        fixed: 'bg-green-500/20 text-green-400 border-green-500/50',
        replayed: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
        failed: 'bg-red-500/20 text-red-400 border-red-500/50',
    }

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${styles[status as keyof typeof styles] || styles.pending}`}>
            {status.toUpperCase()}
        </span>
    )
}

function ConfidenceBadge({ level }: { level: string }) {
    const styles = {
        low: 'text-red-300',
        medium: 'text-yellow-300',
        high: 'text-green-300',
    }

    return (
        <span className={`text-xs font-bold ${styles[level as keyof typeof styles] || 'text-white'}`}>
            {level.toUpperCase()}
        </span>
    )
}
