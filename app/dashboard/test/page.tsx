'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function TestPage() {
    const [eventType, setEventType] = useState<'user' | 'payment'>('user')
    const [includeError, setIncludeError] = useState(true)
    const [isLocal, setIsLocal] = useState(true)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<any>(null)

    async function sendTestEvent() {
        setLoading(true)
        setResult(null)

        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            // Get user's project
            const { data: project } = await supabase
                .from('inngest_fixer_projects')
                .select('*')
                .eq('user_id', user.id)
                .limit(1)
                .single()

            if (!project) {
                toast.error('Please add an Inngest project first!')
                return
            }

            if (!isLocal && !project.inngest_event_key) {
                toast.error('Inngest Event Key is missing for this project. Please add it in project settings.')
                return
            }

            // Build event payload based on type
            let eventPayload
            if (eventType === 'user') {
                eventPayload = {
                    name: 'test/user.created',
                    data: includeError ? {
                        // Missing email field - will cause error
                        user: {
                            // Missing id field - will cause error
                            name: 'John Doe'
                        }
                    } : {
                        // Valid payload
                        email: 'john@example.com',
                        user: {
                            id: 'user_123',
                            name: 'John Doe'
                        }
                    }
                }
            } else {
                eventPayload = {
                    name: 'test/payment.created',
                    data: includeError ? {
                        // Missing amount field - will cause error
                        customer: {
                            // Missing id field - will cause error  
                            name: 'Jane Smith'
                        }
                    } : {
                        // Valid payload
                        amount: 99.99,
                        customer: {
                            id: 'cust_456',
                            name: 'Jane Smith'
                        }
                    }
                }
            }

            // Send to Inngest
            const inngestUrl = isLocal
                ? 'http://localhost:8288/e/'
                : 'https://inn.gs/e/'

            const response = await fetch(inngestUrl + project.inngest_event_key, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventPayload),
            })

            const data = await response.json()
            setResult(data)

            if (response.ok) {
                toast.success('Event sent! Check your dashboard for the failure.')
            } else {
                toast.error('Failed to send event: ' + (data.error || 'Unknown error'))
            }
        } catch (error) {
            console.error('Error:', error)
            toast.error('Error: ' + (error as Error).message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white">
            <nav className="bg-slate-800 border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <h1 className="text-xl font-bold">🧪 Test Events</h1>
                </div>
            </nav>

            <main className="max-w-2xl mx-auto px-4 py-8">
                <div className="bg-slate-800 rounded-lg p-8">
                    <h2 className="text-2xl font-bold mb-6">Send Test Event</h2>

                    <div className="space-y-6">
                        {/* Event Type */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Event Type
                            </label>
                            <select
                                value={eventType}
                                onChange={(e) => setEventType(e.target.value as 'user' | 'payment')}
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="user">test/user.created</option>
                                <option value="payment">test/payment.created</option>
                            </select>
                        </div>

                        {/* Include Error Toggle */}
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="includeError"
                                checked={includeError}
                                onChange={(e) => setIncludeError(e.target.checked)}
                                className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-2 focus:ring-blue-500"
                            />
                            <label htmlFor="includeError" className="text-sm font-medium">
                                Include error (missing required fields)
                            </label>
                        </div>

                        {/* Inngest Environment */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Inngest Environment
                            </label>
                            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
                                <button
                                    onClick={() => setIsLocal(true)}
                                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${isLocal ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    Local Dev
                                </button>
                                <button
                                    onClick={() => setIsLocal(false)}
                                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${!isLocal ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    Inngest Cloud
                                </button>
                            </div>
                        </div>

                        {/* Event Preview */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Event Payload Preview
                            </label>
                            <pre className="bg-slate-900 p-4 rounded-lg text-xs overflow-auto border border-slate-700">
                                {JSON.stringify(
                                    {
                                        name: eventType === 'user' ? 'test/user.created' : 'test/payment.created',
                                        data: eventType === 'user'
                                            ? includeError
                                                ? { user: { name: 'John Doe' } }
                                                : { email: 'john@example.com', user: { id: 'user_123', name: 'John Doe' } }
                                            : includeError
                                                ? { customer: { name: 'Jane Smith' } }
                                                : { amount: 99.99, customer: { id: 'cust_456', name: 'Jane Smith' } }
                                    },
                                    null,
                                    2
                                )}
                            </pre>
                        </div>

                        {/* Send Button */}
                        <button
                            onClick={sendTestEvent}
                            disabled={loading}
                            className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
                        >
                            {loading ? 'Sending...' : '🚀 Send Test Event'}
                        </button>

                        {/* Result */}
                        {result && (
                            <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-4">
                                <h3 className="font-semibold mb-2 text-green-400">Event Sent!</h3>
                                <pre className="text-xs overflow-auto">
                                    {JSON.stringify(result, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>

                    {/* Instructions */}
                    <div className="mt-8 bg-blue-900/20 border border-blue-500/50 rounded-lg p-4">
                        <h3 className="font-semibold mb-2">📝 How to Test:</h3>
                        <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside">
                            <li>Make sure you've added an Inngest project</li>
                            <li>Toggle "Include error" to send a bad payload</li>
                            <li>Click "Send Test Event"</li>
                            <li>Go to your Inngest dashboard to see the function run</li>
                            <li>The function should fail (if error included)</li>
                            <li>The failure webhook should trigger our analyzer</li>
                            <li>Check your dashboard to see the AI analysis</li>
                        </ol>
                    </div>
                </div>
            </main>
        </div>
    )
}