'use client'

import { toast } from 'sonner'
import { useParams } from 'next/navigation'

export function TestWebhookButton({ projectId: manualProjectId }: { projectId?: string }) {
    const params = useParams()
    const projectId = manualProjectId || params?.id as string

    return (
        <button
            onClick={async () => {
                const loadingToast = toast.loading('Simulating Inngest Cloud Webhook...')
                try {
                    const url = new URL('/api/test-webhook', window.location.origin)
                    if (projectId) {
                        url.searchParams.set('project_id', projectId)
                    }

                    const res = await fetch(url.toString(), { method: 'POST' })
                    const data = await res.json()

                    if (res.ok && data.success) {
                        toast.success('Simulation successful! Analysis should appear in a few seconds.', {
                            id: loadingToast,
                            description: 'Wait for the AI to finish processing.'
                        })
                        // Optional: Refresh the page after a delay
                        setTimeout(() => window.location.reload(), 3000)
                    } else {
                        toast.error(data.error || 'Simulation failed', {
                            id: loadingToast,
                            description: data.details || `Make sure you have at least one project configured.`
                        })
                    }
                } catch (error: any) {
                    toast.error('Network error', {
                        id: loadingToast,
                        description: 'Could not connect to the test endpoint.'
                    })
                }
            }}
            className="flex items-center gap-2 text-sm px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 rounded-lg text-blue-400 transition-all font-semibold"
        >
            <span className="animate-pulse">⚡</span> Simulate Cloud Webhook
        </button>
    )
}
