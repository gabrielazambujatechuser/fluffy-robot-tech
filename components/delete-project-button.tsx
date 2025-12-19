'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'

export function DeleteProjectButton({ projectId, projectName }: { projectId: string; projectName: string }) {
    const [isDeleting, setIsDeleting] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    async function handleDelete() {
        setIsDeleting(true)
        try {
            const { error } = await supabase
                .from('inngest_fixer_projects')
                .delete()
                .eq('id', projectId)

            if (error) throw error

            toast.success(`Project "${projectName}" deleted successfully`)
            router.push('/dashboard')
            router.refresh()
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete project')
            setIsDeleting(false)
        }
    }

    if (showConfirm) {
        return (
            <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Are you sure?</span>
                <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 px-3 rounded transition-all disabled:opacity-50"
                >
                    {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
                <button
                    onClick={() => setShowConfirm(false)}
                    disabled={isDeleting}
                    className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-2 px-3 rounded transition-all disabled:opacity-50"
                >
                    Cancel
                </button>
            </div>
        )
    }

    return (
        <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors text-sm font-medium"
        >
            <Trash2 size={16} />
            Delete Project
        </button>
    )
}
