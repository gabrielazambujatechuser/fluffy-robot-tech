import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { processFailureEvent } from '@/lib/services/fixer'

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
            try {
                const eventType = payload.name || payload.event
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
                    console.error('❌ [WEBHOOK] Missing required fields in payload')
                    continue
                }

                const failureData = {
                    function_id,
                    run_id,
                    event: originalEvent,
                    error
                }

                // Call shared service
                await processFailureEvent(
                    projectId!,
                    failureData,
                    rawBody,
                    req.headers.get('x-inngest-signature') || undefined
                )

            } catch (err: any) {
                console.error(`❌ [WEBHOOK] Failed to process event in batch:`, err.message)
                // Continue to next event in batch
            }
        }

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