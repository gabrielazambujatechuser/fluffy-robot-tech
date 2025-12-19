import { NextResponse } from 'next/server'

export async function GET(req: Request) {
    return POST(req)
}

export async function POST(req: Request) {
    // Simulate Inngest failure webhook
    const mockWebhook = {
        event: 'function.failed',
        data: {
            function_id: 'test-failing-function',
            run_id: 'run_' + Math.random().toString(36).substring(7),
            event: {
                id: 'evt_' + Math.random().toString(36).substring(7),
                name: 'test/user.created',
                data: {
                    user: {
                        name: 'John Doe'
                    }
                    // Missing email and user.id
                },
                ts: Date.now(),
            },
            error: {
                name: 'Error',
                message: 'Missing required field: email',
                stack: 'Error: Missing required field: email\n    at testFailingFunction...',
            },
        }
    }

    // Forward to actual webhook handler
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const { searchParams } = new URL(req.url)
    const webhookUrl = new URL('/api/webhook/inngest', origin)

    // Append existing search params (like project_id)
    searchParams.forEach((value, key) => {
        webhookUrl.searchParams.set(key, value)
    })

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mockWebhook),
        })

        const contentType = response.headers.get('content-type')
        if (contentType?.includes('application/json')) {
            const data = await response.json()
            return NextResponse.json(data, { status: response.status })
        } else {
            const text = await response.text()
            return NextResponse.json({
                error: 'Upstream returned non-JSON response',
                status: response.status,
                details: text.substring(0, 100)
            }, { status: 500 })
        }
    } catch (error: any) {
        return NextResponse.json({
            error: 'Failed to reach webhook handler',
            details: error.message
        }, { status: 500 })
    }
}