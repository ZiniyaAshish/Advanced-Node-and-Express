// Do not change this file
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function myDB(callback) {
    const URI = process.env.MONGO_URI; 
    const client = new MongoClient(URI, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        // Connect to the MongoDB cluster
        await client.connect().then(
            () => {
                console.log('Connected to MongoDB');
            }
        );
        // Make the appropriate DB calls
        await callback(client);

    } catch (e) {
        // Catch any errors
        console.error(e);
        throw new Error('Unable to Connect to Database')
    }
}

module.exports = myDB;