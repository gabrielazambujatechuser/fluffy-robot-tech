import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
import { UserInfo } from '@/components/user-info'
import { AuthToast } from '@/components/auth-toast'
import Link from 'next/link'
import { Suspense } from 'react'

export default async function DashboardPage() {
    return (
        <div className="min-h-screen bg-slate-900 text-white">
            <AuthToast />
            {/* Nav */}
            <nav className="bg-slate-800 border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                    <h1 className="text-xl font-bold">🔧 Inngest Fixer</h1>
                    <div className="flex items-center gap-4">
                        <Link
                            href="/dashboard/test"
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
                        >
                            Test Events
                        </Link>
                        <UserInfo />
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 py-8">
                <Suspense fallback={<DashboardSkeleton />}>
                    <DashboardContent />
                </Suspense>
            </main>
        </div>
    )
}

async function DashboardContent() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/')
    }

    // Get user's projects
    const { data: projects } = await supabase
        .from('inngest_fixer_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    // Get recent failures
    const { data: failures } = await supabase
        .from('inngest_fixer_failure_events')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

    return (
        <>
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatCard
                    title="Total Failures"
                    value={failures?.length || 0}
                    color="red"
                />
                <StatCard
                    title="Auto-Fixed"
                    value={failures?.filter(f => f.status === 'fixed').length || 0}
                    color="green"
                />
                <StatCard
                    title="Success Rate"
                    value={failures?.length ?
                        `${Math.round((failures.filter(f => f.status === 'fixed').length / failures.length) * 100)}%`
                        : '0%'}
                    color="blue"
                />
            </div>

            {/* Projects */}
            <div className="bg-slate-800 rounded-lg p-6 mb-8">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">Your Projects</h2>
                    <Link
                        href="/dashboard/projects/new"
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
                    >
                        + Add Project
                    </Link>
                </div>

                {projects && projects.length > 0 ? (
                    <div className="space-y-4">
                        {projects.map((project) => (
                            <div key={project.id} className="bg-slate-900 border border-slate-700 rounded-lg p-4 flex justify-between items-center hover:border-blue-500/50 transition-colors group">
                                <div>
                                    <h3 className="font-semibold text-lg group-hover:text-blue-400 transition-colors">{project.project_name}</h3>
                                    <p className="text-sm text-slate-400">
                                        Added {new Date(project.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Link
                                        href={`/dashboard/projects/${project.id}`}
                                        className="text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded text-slate-300 transition-colors"
                                    >
                                        Settings ⚙️
                                    </Link>
                                    <Link
                                        href={`/dashboard/projects/${project.id}`}
                                        className="text-blue-400 hover:text-blue-300 transition-colors font-medium"
                                    >
                                        View Failures →
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-slate-900/50 border-2 border-dashed border-slate-700 rounded-xl">
                        <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                            🚀
                        </div>
                        <h3 className="text-xl font-bold mb-2 text-white">No Projects Configured</h3>
                        <p className="text-slate-400 mb-8 max-w-sm mx-auto">
                            Add your first project to start monitoring Inngest failures with AI-powered analysis.
                        </p>
                        <Link
                            href="/dashboard/projects/new"
                            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-xl text-white font-bold transition-all hover:scale-105 shadow-lg shadow-blue-500/20"
                        >
                            <span>+</span> Create Your First Project
                        </Link>
                    </div>
                )}
            </div>

            {/* Recent Failures */}
            <div className="bg-slate-800 rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-4">Recent Failures</h2>

                {failures && failures.length > 0 ? (
                    <div className="space-y-4">
                        {failures.map((failure) => (
                            <Link
                                key={failure.id}
                                href={`/dashboard/failures/${failure.id}`}
                                className="block bg-slate-900 rounded-lg p-4 hover:bg-slate-800/50 transition-colors"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="font-semibold text-blue-400">{failure.function_id}</h3>
                                        <p className="text-sm text-slate-400 truncate max-w-md">{failure.error_message}</p>
                                    </div>
                                    <StatusBadge status={failure.status} />
                                </div>
                                <p className="text-xs text-slate-500">
                                    {new Date(failure.created_at).toLocaleString()}
                                </p>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-700 rounded-lg">
                        <p>No failures yet. Your Inngest functions are running smoothly! 🎉</p>
                    </div>
                )}
            </div>
        </>
    )
}

function DashboardSkeleton() {
    return (
        <div className="animate-pulse space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-32 bg-slate-800 rounded-lg" />
                ))}
            </div>
            <div className="h-64 bg-slate-800 rounded-lg" />
            <div className="h-64 bg-slate-800 rounded-lg" />
        </div>
    )
}

function StatCard({ title, value, color }: { title: string; value: string | number; color: string }) {
    const colors = {
        red: 'from-red-500 to-red-600',
        green: 'from-green-500 to-green-600',
        blue: 'from-blue-500 to-blue-600',
    }

    return (
        <div className={`bg-gradient-to-br ${colors[color as keyof typeof colors]} rounded-lg p-6`}>
            <h3 className="text-sm font-medium opacity-90 mb-2">{title}</h3>
            <p className="text-4xl font-bold">{value}</p>
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
        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles] || styles.pending}`}>
            {status}
        </span>
    )
}