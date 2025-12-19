import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { DeleteProjectButton } from '@/components/delete-project-button'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/')
    }

    const { data: project } = await supabase
        .from('inngest_fixer_projects')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

    if (!project) {
        notFound()
    }

    const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://fluffy-robot-tech.vercel.app'}/api/webhook/inngest?project_id=${project.id}`

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            <div className="max-w-4xl mx-auto">
                <nav className="mb-8 flex justify-between items-center">
                    <Link href="/dashboard" className="text-blue-400 hover:text-blue-300 transition-colors">
                        ← Back to Dashboard
                    </Link>
                    <DeleteProjectButton projectId={project.id} projectName={project.project_name} />
                </nav>

                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">{project.project_name}</h1>
                        <p className="text-slate-400">Project ID: {project.id}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <span>🛰️</span> Webhook Configuration
                        </h2>
                        <p className="text-slate-400 mb-6 text-sm">
                            Use this unique URL in your Inngest project settings to enable AI-powered fixes.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Webhook URL</label>
                                <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 flex justify-between items-center group">
                                    <code className="text-blue-400 text-sm break-all">{webhookUrl}</code>
                                </div>
                            </div>

                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                                <h3 className="text-blue-400 font-semibold text-sm mb-2">Instructions</h3>
                                <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                                    <li>Add this URL in <strong>Inngest Cloud → Settings → Webhooks</strong>.</li>
                                    <li>Enable the <code>function.failed</code> event.</li>
                                    <li>Ensure your <strong>Signing Key</strong> is added to this project.</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <span>🔐</span> Security
                        </h2>
                        <p className="text-slate-400 mb-6 text-sm">
                            Signing Key status and security settings.
                        </p>

                        <div className="p-4 rounded-lg bg-slate-900 border border-slate-700 mb-4">
                            {project.inngest_event_key ? (
                                <div className="flex items-center gap-3 text-green-400">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-sm font-medium">Event Key Configured</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 text-red-400">
                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                    <span className="text-sm font-medium">Event Key Missing</span>
                                </div>
                            )}
                        </div>

                        <div className="p-4 rounded-lg bg-slate-900 border border-slate-700">
                            {project.signing_key ? (
                                <div className="flex items-center gap-3 text-green-400">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-sm font-medium">Signing Key Active</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 text-yellow-400">
                                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                    <span className="text-sm font-medium">Signing Key Missing</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-8 bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <span>🚀</span> Inngest Forwarder (Recommended)
                    </h2>
                    <p className="text-slate-400 mb-6 text-sm">
                        Add this function to your project's Inngest configuration to automatically forward all failures to the AI analyzer.
                    </p>

                    <div className="relative group">
                        <pre className="bg-slate-900 p-4 rounded-lg border border-slate-700 text-blue-300 text-sm font-mono overflow-x-auto">
                            {`// Add this to your inngest/functions file
export const inngestFixerForwarder = inngest.createFunction(
  { id: "inngest-fixer-forwarder", name: "Inngest Fixer Forwarder" },
  { event: "inngest/function.failed" },
  async ({ event }) => {
    await fetch("${webhookUrl}", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
  }
);`}
                        </pre>
                        <div className="mt-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <h3 className="text-blue-400 font-semibold text-sm mb-2">Why use this?</h3>
                            <p className="text-xs text-slate-300">
                                Instead of manually setting up webhooks in the Inngest dashboard, this function "catches" any failure in your system and forwards it for analysis. It works for all your functions at once!
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
