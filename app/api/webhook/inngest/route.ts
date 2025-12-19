import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
})

interface InngestFailureWebhook {
    name?: string
    event?: string
    function_id?: string
    run_id?: string
    data?: {
        function_id?: string
        run_id?: string
        event?: {
            id: string
            name: string
            data: any
            ts: number
        }
        error?: {
            message: string
            name: string
            stack?: string
        }
    }
    // Backward compatibility for simulation/legacy
    event_data?: {
        function_id?: string
        run_id?: string
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
        let projectId = searchParams.get('project_id')

        console.log(`🔔 [WEBHOOK] Received Inngest failure webhook. ProjectID from query: ${projectId || 'none'}`)

        // Environment checks
        if (!process.env.ANTHROPIC_API_KEY) {
            console.error('❌ [WEBHOOK] Missing ANTHROPIC_API_KEY')
        }
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error('❌ [WEBHOOK] Missing SUPABASE_SERVICE_ROLE_KEY')
        }

        // Clone request for signature verification
        const rawBody = await req.text()
        const parsed = JSON.parse(rawBody)

        // Handle single event or array
        const events: InngestFailureWebhook[] = Array.isArray(parsed) ? parsed : [parsed]

        console.log(`📦 [WEBHOOK] Processing batch of ${events.length} events`)

        for (const payload of events) {
            const eventType = payload.name || payload.event

            console.log('📦 [WEBHOOK] Event structure:', JSON.stringify({
                type: eventType,
                has_data: !!payload.data,
                has_event_data: !!payload.event_data,
                has_root_error: !!(payload as any).error // Check if error is at root
            }))

            // Normalize event data
            const data = payload.data || payload.event_data
            const function_id = payload.function_id || data?.function_id
            const run_id = payload.run_id || data?.run_id
            const originalEvent = data?.event
            const error = data?.error

            // Verify it's a failure event
            const isFailureEvent = eventType && (
                eventType === 'function/failed' ||
                eventType === 'function.failed' ||
                eventType === 'inngest/function.failed'
            )

            if (!isFailureEvent) {
                console.log(`ℹ️ [WEBHOOK] Skipping non-failure event: ${eventType}`)
                continue
            }

            if (!function_id || !run_id || !originalEvent || !error) {
                console.error('❌ [WEBHOOK] Missing required fields in payload:', {
                    has_function_id: !!function_id,
                    has_run_id: !!run_id,
                    has_event: !!originalEvent,
                    has_error: !!error
                })
                console.log('📦 [WEBHOOK] Full Payload:', rawBody)
                return NextResponse.json({
                    error: 'Invalid payload',
                    details: 'Payload is missing required Inngest function/run/event data'
                }, { status: 400 })
            }

            const eventId = originalEvent.id || `gen_${Math.random().toString(36).substring(7)}`

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
                console.error(`❌ [WEBHOOK] No project found for ID: ${projectId || 'any'}`)
                continue
            }

            console.log(`✅ [PROJECT] Found project: ${project.project_name} (${project.id})`)

            // SIGNATURE VERIFICATION
            const signatureHeader = req.headers.get('x-inngest-signature')
            if (project.signing_key && signatureHeader) {
                console.log('🔒 [WEBHOOK] Verifying signature...')
                try {
                    // Signature format can be t=<timestamp>&s=<signature> OR comma separated
                    const parts = signatureHeader.includes('&')
                        ? signatureHeader.split('&')
                        : signatureHeader.split(',')

                    const timestamp = parts.find(p => p.trim().startsWith('t='))?.split('=')[1]
                    const signature = parts.find(p => p.trim().startsWith('s='))?.split('=')[1]

                    if (!timestamp || !signature) throw new Error('Invalid signature header format')

                    // Try both concat and dot separator just in case
                    const hmac = crypto.createHmac('sha256', project.signing_key)
                    hmac.update(timestamp + rawBody)
                    const expectedSignature = hmac.digest('hex')

                    const hmacWithDot = crypto.createHmac('sha256', project.signing_key)
                    hmacWithDot.update(timestamp + '.' + rawBody)
                    const expectedSignatureWithDot = hmacWithDot.digest('hex')

                    if (signature !== expectedSignature && signature !== expectedSignatureWithDot) {
                        console.error('❌ [WEBHOOK] Invalid signature. Checked with and without dot.')
                        continue
                    }
                    console.log('✅ [WEBHOOK] Signature verified')
                } catch (err: any) {
                    console.error('❌ [WEBHOOK] Signature verification failed:', err.message)
                    continue
                }
            }

            // 1. Initial save to DB (Pending state)
            const { data: failureEvent, error: dbError } = await supabase
                .from('inngest_fixer_failure_events')
                .insert({
                    project_id: project.id,
                    user_id: project.user_id,
                    event_id: eventId,
                    function_id,
                    run_id,
                    error_message: error.message,
                    original_payload: originalEvent,
                    status: 'pending',
                })
                .select()
                .single()

            if (dbError) {
                console.error('❌ [DATABASE] Failed to save pending failure:', dbError)
                continue
            }

            console.log('✅ [DATABASE] Saved pending failure:', failureEvent.id)

            // 2. Analyze with Claude
            try {
                console.log('🤖 [CLAUDE] Sending to Claude for analysis...')

                const message = await anthropic.messages.create({
                    model: 'claude-3-5-sonnet-latest',
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

                // 3. Update DB with analysis
                const { error: updateError } = await supabase
                    .from('inngest_fixer_failure_events')
                    .update({
                        fixed_payload: fixedPayload,
                        ai_analysis: `${analysis}\n\nRoot Cause: ${rootCause}`,
                        fix_confidence: confidence,
                        status: fixedPayload ? 'fixed' : 'failed',
                    })
                    .eq('id', failureEvent.id)

                if (updateError) {
                    console.error('❌ [DATABASE] Failed to update analysis:', updateError)
                } else {
                    console.log('✅ [WEBHOOK] Failure analyzed and updated:', failureEvent.id)
                }

            } catch (claudeError: any) {
                console.error('❌ [CLAUDE] Analysis failed:', claudeError.message)
                // Update record to mark as failed analysis
                await supabase
                    .from('inngest_fixer_failure_events')
                    .update({
                        ai_analysis: `AI Analysis failed: ${claudeError.message}`,
                        status: 'failed'
                    })
                    .eq('id', failureEvent.id)
            }
        } // End of loop over events

        return NextResponse.json({
            success: true,
            message: 'Webhook processed successfully'
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