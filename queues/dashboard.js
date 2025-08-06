const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');

const {
    createPaymentIntentQueue,
    webhookHandlerQueue,
    sendOrderBookedEmailQueue
} = require('./producer');

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
    queues: [
        new BullMQAdapter(createPaymentIntentQueue),
        new BullMQAdapter(webhookHandlerQueue),
        new BullMQAdapter(sendOrderBookedEmailQueue),
    ],

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
