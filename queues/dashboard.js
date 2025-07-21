const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');

const {
    queueGetAcivityById,
    createPaymentIntentQueue,
    webhookHandlerQueue,
} = require('./producer');

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
    queues: [
        new BullMQAdapter(queueGetAcivityById),
        new BullMQAdapter(createPaymentIntentQueue),
        new BullMQAdapter(webhookHandlerQueue)],
    serverAdapter,
    options: {
        uiConfig: {
            boardTitle: 'My BOARD',
            boardLogo: {
                path: 'https://cdn.my-domain.com/logo.png',
                width: '100px',
                height: 200,
            },
            miscLinks: [{ text: 'Logout', url: '/logout' }],
            favIcon: {
                default: 'static/images/logo.svg',
                alternative: 'static/favicon-32x32.png',
            },
        },
    },
});

module.exports = { serverAdapter };
