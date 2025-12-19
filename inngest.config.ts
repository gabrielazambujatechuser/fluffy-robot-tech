import { Inngest } from 'inngest'

export const inngest = new Inngest({
    id: 'inngest-fixer-app',
    name: 'Inngest Fixer',
    eventKey: process.env.INNGEST_EVENT_KEY,
})