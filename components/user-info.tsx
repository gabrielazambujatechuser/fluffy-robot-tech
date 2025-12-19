'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

export function UserInfo() {
    const [user, setUser] = useState<User | null>(null)
    const supabase = createClient()

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user)
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        window.location.href = '/?toast=logout_success'
    }

    if (!user) return null

    return (
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                {user.user_metadata.avatar_url && (
                    <img
                        src={user.user_metadata.avatar_url}
                        alt={user.user_metadata.full_name || user.email}
                        className="w-8 h-8 rounded-full"
                    />
                )}
                <span className="text-sm font-medium">
                    {user.user_metadata.full_name || user.email}
                </span>
            </div>
            <button
                onClick={handleLogout}
                className="text-sm text-slate-400 hover:text-white"
            >
                Sign out
            </button>
        </div>
    )
}