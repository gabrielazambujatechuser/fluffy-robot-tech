export default function Loading() {
    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            <div className="max-w-4xl mx-auto">
                <div className="animate-pulse space-y-8">
                    <div className="h-6 w-32 bg-slate-800 rounded mb-8" />

                    <div className="mb-8 space-y-4">
                        <div className="h-10 w-1/2 bg-slate-800 rounded" />
                        <div className="h-4 w-1/3 bg-slate-800 rounded" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="h-64 bg-slate-800 rounded-xl border border-slate-700" />
                        <div className="h-64 bg-slate-800 rounded-xl border border-slate-700" />
                    </div>
                </div>
            </div>
        </div>
    )
}
