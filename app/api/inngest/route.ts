import { inngest } from '@/inngest.config'
import { serve } from 'inngest/next'
import { processFailureEvent } from '@/lib/services/fixer'

// Test function that will fail on purpose
const testFailingFunction = inngest.createFunction(
    {
        id: 'test-failing-function',
        name: 'Test Failing Function',
        retries: 0,
    },
    { event: 'test/user.created' },
    async ({ event, step }) => {
        console.log('🔍 Processing event:', event)

        // This will fail if email is missing
        const email = event.data.email

        if (!email) {
            throw new Error('Missing required field: email')
        }

        // This will fail if user object is missing
        const userId = event.data.user?.id
        if (!userId) {
            throw new Error('Missing required field: user.id')
        }

        await step.run('send-welcome-email', async () => {
            console.log(`Sending email to: ${email}`)
            return {
                sent: true,
                to: email,
                userId
            }
        })

        await step.run('create-profile', async () => {
            console.log(`Creating profile for user: ${userId}`)
            return {
                created: true,
                userId
            }
        })

        return {
            success: true,
            email,
            userId
        }
    }
)

// Another test function for payment processing
const testPaymentFunction = inngest.createFunction(
    {
        id: 'test-payment-processor',
        name: 'Test Payment Processor',
        retries: 0,
    },
    { event: 'test/payment.created' },
    async ({ event, step }) => {
        console.log('💳 Processing payment:', event)

        // Will fail if amount is missing
        const amount = event.data.amount
        if (!amount || amount <= 0) {
            throw new Error('Invalid payment amount: must be greater than 0')
        }

        // Will fail if customer is missing
        const customerId = event.data.customer?.id
        if (!customerId) {
            throw new Error('Missing required field: customer.id')
        }

        await step.run('charge-customer', async () => {
            console.log(`Charging customer ${customerId}: $${amount}`)
            return {
                charged: true,
                amount,
                customerId
            }
        })

        return {
            success: true,
            amount,
            customerId
        }
    }
)

// Native failure handler that processes system events from any connected Inngest environment
const inngestFixerHandler = inngest.createFunction(
    { id: 'inngest-fixer-handler', name: 'Inngest Fixer Handler' },
    { event: 'inngest/function.failed' },
    async ({ event, step, projectId }: any) => {
        // Use projectId from middleware context
        let targetProjectId = projectId

        if (!targetProjectId || targetProjectId === 'all') {
            // Fallback: If no project ID is in the context (e.g. internal test event),
            // try to find the most recent project to attribute this to.
            await step.run('find-default-project', async () => {
                const { createClient } = await import('@/lib/supabase/server')
                const supabase = await createClient()
                const { data: project } = await supabase
                    .from('inngest_fixer_projects')
                    .select('id')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single()

                if (project) {
                    targetProjectId = project.id
                }
            })
        }

        if (!targetProjectId || targetProjectId === 'all') {
            console.error('❌ [INNGEST] No project ID found or resolvable. Skipping analysis.')
            return {
                message: 'Skipped: No project ID available',
                status: 'skipped'
            }
        }

        await step.run('process-failure', async () => {
            return await processFailureEvent(
                targetProjectId,
                {
                    function_id: event.data.function_id,
                    run_id: event.data.run_id,
                    event: event.data.event,
                    error: event.data.error
                }
            )
        })
    }
)

// Export the Inngest API route
export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [
        testFailingFunction,
        testPaymentFunction,
        inngestFixerHandler,
    ],
    signingKey: process.env.INNGEST_SIGNING_KEY,
})