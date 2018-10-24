const storage = require('node-persist');

const env = process.env.NODE_ENV;

export default async () => {
    await storage.init();

    return {
        async get (name) {
            return await storage.getItem(`${env}-${name}`);
        },
        async set (name, value) {
            await storage.setItem(`${env}-${name}`, value);
        }
    };
}
