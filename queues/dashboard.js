const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');

const {
    webhookHandlerQueue,
    sendOrderBookedEmailQueue,
    subscriptionQueue,
    emailNotificationQueue
} = require('./queueInstances');

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
    queues: [
        new BullMQAdapter(webhookHandlerQueue),
        new BullMQAdapter(sendOrderBookedEmailQueue),
        new BullMQAdapter(subscriptionQueue),
        new BullMQAdapter(emailNotificationQueue),
    ],

    serverAdapter,
    options: {
        uiConfig: {
            boardTitle: 'Healworld Queue Dashboard',
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
