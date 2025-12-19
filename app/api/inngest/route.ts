import { inngest } from '@/inngest.config'
import { serve } from 'inngest/next'

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

// Export the Inngest API route
export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [
        testFailingFunction,
        testPaymentFunction,
    ],
    signingKey: process.env.INNGEST_SIGNING_KEY,
})