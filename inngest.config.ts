import { Inngest, InngestMiddleware } from 'inngest'

export const inngest = new Inngest({
    id: 'inngest-fixer-app',
    name: 'Inngest Fixer',
    eventKey: process.env.INNGEST_EVENT_KEY,
    middleware: [
        new InngestMiddleware({
            name: 'ProjectContext',
            init: () => ({
                onFunctionRun: (data: any) => {
                    // Try to extract project_id from common request properties
                    const req = data.req || data.reqArgs?.[0];
                    const url = new URL(req?.url || '');
                    const projectId = url.searchParams.get('project_id');
                    return {
                        transformInput: () => ({
                            ctx: { projectId },
                        }),
                    };
                },
            }),
        }),
    ],
})