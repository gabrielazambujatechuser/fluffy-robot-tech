import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import crypto from 'crypto'

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface FailureEventData {
    function_id: string
    run_id: string
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

export async function processFailureEvent(
    projectId: string,
    data: FailureEventData,
    rawBody?: string,
    signatureHeader?: string
) {
    console.log(`🔧 [FIXER SERVICE] Processing failure for project ${projectId}`)

    // 1. Initialize Supabase with service role (bypasses RLS for background jobs)
    const supabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Find project
    const { data: project, error: projectError } = await supabase
        .from('inngest_fixer_projects')
        .select('*')
        .eq('id', projectId)
        .single()

    if (projectError || !project) {
        console.error('❌ [FIXER SERVICE] Project query error:', projectError)
        throw new Error(`Project not found: ${projectId}`)
    }

    // 2. Signature Verification (if applicable)
    if (project.signing_key && signatureHeader && rawBody) {
        console.log('🔒 [FIXER SERVICE] Verifying signature...')
        const parts = signatureHeader.includes('&')
            ? signatureHeader.split('&')
            : signatureHeader.split(',')

        const timestamp = parts.find(p => p.trim().startsWith('t='))?.split('=')[1]
        const signature = parts.find(p => p.trim().startsWith('s='))?.split('=')[1]

        if (!timestamp || !signature) throw new Error('Invalid signature header format')

        const hmac = crypto.createHmac('sha256', project.signing_key)
        hmac.update(timestamp + rawBody)
        const expectedSignature = hmac.digest('hex')

        const hmacWithDot = crypto.createHmac('sha256', project.signing_key)
        hmacWithDot.update(timestamp + '.' + rawBody)
        const expectedSignatureWithDot = hmacWithDot.digest('hex')

        if (signature !== expectedSignature && signature !== expectedSignatureWithDot) {
            throw new Error('Invalid signature')
        }
        console.log('✅ [FIXER SERVICE] Signature verified')
    }

    const { function_id, run_id, event: originalEvent, error } = data
    const eventId = originalEvent.id || `gen_${Math.random().toString(36).substring(7)}`

    // 3. Save Pending Failure
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

    if (dbError) throw dbError

    console.log('✅ [FIXER SERVICE] Saved pending failure:', failureEvent.id)

    // 4. Analyze with Claude (Background-ish)
    try {
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

        await supabase
            .from('inngest_fixer_failure_events')
            .update({
                fixed_payload: fixedPayload,
                ai_analysis: `${analysis}\n\nRoot Cause: ${rootCause}`,
                fix_confidence: confidence,
                status: fixedPayload ? 'fixed' : 'failed',
            })
            .eq('id', failureEvent.id)

        return { success: true, failureId: failureEvent.id }

    } catch (claudeError: any) {
        console.error('❌ [FIXER SERVICE] AI Analysis failed:', claudeError.message)
        await supabase
            .from('inngest_fixer_failure_events')
            .update({
                ai_analysis: `AI Analysis failed: ${claudeError.message}`,
                status: 'failed'
            })
            .eq('id', failureEvent.id)

        return { success: false, failureId: failureEvent.id, error: claudeError.message }
    }
}
