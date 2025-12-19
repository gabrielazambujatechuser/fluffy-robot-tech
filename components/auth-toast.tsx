'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useEffect, Suspense } from 'react'
import { toast } from 'sonner'

function AuthToastContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        const toastType = searchParams.get('toast')
        if (toastType) {
            if (toastType === 'login_success') {
                toast.success('Successfully signed in!')
            } else if (toastType === 'login_error') {
                toast.error('Failed to sign in. Please try again.')
            } else if (toastType === 'logout_success') {
                toast.success('Signed out successfully.')
            }

            // Remove the query param from URL without refreshing
            const params = new URLSearchParams(searchParams)
            params.delete('toast')
            const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
            router.replace(newUrl, { scroll: false })
        }
    }, [searchParams, pathname, router])

    return null
}

export function AuthToast() {
    return (
        <Suspense fallback={null}>
            <AuthToastContent />
        </Suspense>
    )
}
