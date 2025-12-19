import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
})

interface InngestFailureWebhook {
    event: string
    function_id: string
    run_id: string
    event_data: {
        event: {
            id: string
            name: string
            data: any
            ts: number
        }
        error: {
            message: string
            name: string
            stack?: string
        }
    }
}

export async function POST(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const projectId = searchParams.get('project_id')

        console.log(`🔔 [WEBHOOK] Received Inngest failure webhook for project: ${projectId || 'all'}`)

        // Clone request for signature verification
        const rawBody = await req.text()
        const payload: InngestFailureWebhook = JSON.parse(rawBody)

        const {
            event: eventType,
            function_id,
            run_id,
            event_data,
        } = payload

        // Verify it's a function.failed event
        if (eventType !== 'function/failed') {
            console.log('ℹ️ [WEBHOOK] Not a failure event, skipping')
            return NextResponse.json({ message: 'Not a failure event' })
        }

        if (!function_id || !run_id) {
            console.error('❌ [WEBHOOK] Missing required fields')
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
        }

        const originalEvent = event_data.event
        const error = event_data.error

        console.log(`🔍 [ANALYSIS] Analyzing failure for function: ${function_id}`)
        console.log(`❌ [ERROR] ${error.message}`)

        // Use service role to bypass RLS
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: { autoRefreshToken: false, persistSession: false },
            }
        )

        // Find which project this belongs to
        let query = supabase.from('inngest_fixer_projects').select('*')
        if (projectId) {
            query = query.eq('id', projectId)
        }

        const { data: project } = await query.limit(1).single()

        if (!project) {
            console.error('❌ [WEBHOOK] No project found')
            return NextResponse.json({ error: 'No project configured' }, { status: 404 })
        }

        // SIGNATURE VERIFICATION
        const signatureHeader = req.headers.get('x-inngest-signature')
        if (project.signing_key && signatureHeader) {
            console.log('🔒 [WEBHOOK] Verifying signature...')
            try {
                // Signature format: t=<timestamp>&s=<signature>
                const parts = signatureHeader.split('&')
                const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1]
                const signature = parts.find(p => p.startsWith('s='))?.split('=')[1]

                if (!timestamp || !signature) throw new Error('Invalid signature header format')

                const hmac = crypto.createHmac('sha256', project.signing_key)
                hmac.update(timestamp + rawBody)
                const expectedSignature = hmac.digest('hex')

                if (signature !== expectedSignature) {
                    console.error('❌ [WEBHOOK] Invalid signature')
                    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
                }
                console.log('✅ [WEBHOOK] Signature verified')
            } catch (err: any) {
                console.error('❌ [WEBHOOK] Signature verification failed:', err.message)
                return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 })
            }
        }

        // Analyze with Claude
        console.log('🤖 [CLAUDE] Sending to Claude for analysis...')

        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            messages: [{
                role: 'user',
                content: `You are debugging an Inngest function failure. 

Function ID: ${function_id}
Event Name: ${originalEvent.name}

Error Message: ${error.message}
Error Type: ${error.name}

Original Event Payload:
\`\`\`json
${JSON.stringify(originalEvent.data, null, 2)}
\`\`\`

${error.stack ? `Stack Trace:\n\`\`\`\n${error.stack}\n\`\`\`` : ''}

Your task:
1. Identify what field(s) are missing or incorrect
2. Explain the root cause in simple terms
3. Provide a FIXED version of the event.data payload
4. Rate your confidence (low/medium/high)

Respond in this exact format:
ANALYSIS: [brief explanation of what went wrong]
ROOT_CAUSE: [why it happened]
CONFIDENCE: [low/medium/high]
FIXED_PAYLOAD:
\`\`\`json
{
  "name": "${originalEvent.name}",
  "data": {
    [corrected data object here]
  }
}
\`\`\`
`
            }]
        })

        const response = message.content[0].type === 'text' ? message.content[0].text : ''
        console.log('✅ [CLAUDE] Analysis complete')

        // Parse Claude's response
        const analysisMatch = /ANALYSIS: (.+?)(?=ROOT_CAUSE:)/s.exec(response)
        const causeMatch = /ROOT_CAUSE: (.+?)(?=CONFIDENCE:)/s.exec(response)
        const confidenceMatch = /CONFIDENCE: (low|medium|high)/i.exec(response)
        const fixedPayloadMatch = /FIXED_PAYLOAD:\s*```json\s*(.+?)\s*```/s.exec(response)

        let fixedPayload = null
        if (fixedPayloadMatch) {
            try {
                fixedPayload = JSON.parse(fixedPayloadMatch[1])
            } catch (e) {
                console.error('Failed to parse fixed payload:', e)
            }
        }

        const analysis = analysisMatch?.[1]?.trim() || 'Analysis failed'
        const rootCause = causeMatch?.[1]?.trim() || 'Unknown'
        const confidence = confidenceMatch?.[1]?.toLowerCase() as 'low' | 'medium' | 'high' || 'low'

        // Save to database
        const { data: failureEvent, error: dbError } = await supabase
            .from('inngest_fixer_failure_events')
            .insert({
                project_id: project.id,
                user_id: project.user_id,
                event_id: originalEvent.id,
                function_id,
                run_id,
                error_message: error.message,
                original_payload: originalEvent,
                fixed_payload: fixedPayload,
                ai_analysis: `${analysis}\n\nRoot Cause: ${rootCause}`,
                fix_confidence: confidence,
                status: fixedPayload ? 'fixed' : 'failed',
            })
            .select()
            .single()

        if (dbError) {
            console.error('❌ [DATABASE] Failed to save:', dbError)
            return NextResponse.json({ error: 'Database error' }, { status: 500 })
        }

        console.log('✅ [WEBHOOK] Failure analyzed and saved:', failureEvent.id)

        return NextResponse.json({
            success: true,
            failure_id: failureEvent.id,
            has_fix: !!fixedPayload,
            confidence,
            analysis: analysis.substring(0, 100) + '...',
        })

    } catch (error) {
        console.error('❌ [WEBHOOK] Error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        )
    }
}

export const maxDuration = 60