const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 8000

const app = express()

// middleware
const corsOptions = {
    origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        ''
    ],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions));
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jakl9vf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {

        const userCollection = client.db('eventopia').collection('users')
        const eventsCollection = client.db('eventopia').collection('events')

        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1h'
            });
            res.send({ token });
        })

        // middlewares for verify token
        const verifyToken = (req, res, next) => {
            console.log('inside verify token', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1]
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' });
                }
                req.decoded = decoded;
                next();
            })
        }

        // post user to db
        app.post('/users', async (req, res) => {
            const user = req.body;

            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'User already exists', insertedId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result)
        });

        // post package by authenticate user to db
        app.post('/events', verifyToken, async (req, res) => {
            const item = req.body;
            const result = await eventsCollection.insertOne(item);
            res.send(result);
        })

        // get all packages from db
        app.get('/events', async (req, res) => {
            const result = await eventsCollection.find().toArray()
            res.send(result)
        })

        // get post by specific authenticate user by email
        app.get('/events/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            const query = { 'organizer.email': email }
            const result = await eventsCollection.find(query).toArray()
            res.send(result)
        })

        // get a package by id
        app.get('/event/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await eventsCollection.findOne(query);
            res.send(result);
        })

        // update or edit a package by id with admin
        app.patch('/events/:id', verifyToken, async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    title: item.title,
                    type: item.type,
                    date: item.date,
                    description: item.description,
                    image: item.image,
                    price: item.price,
                    venue: item.venue,
                    organizer: {
                        name: item.organizer.name,
                        email: item.organizer.email,
                        photo: item.organizer.photo
                    }
                }
            }
            const result = await eventsCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })

        // delete a event by authenticate user
        app.delete('/events/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await eventsCollection.deleteOne(query);
            res.send(result);
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello from eventopia server')
})


app.listen(port, () => console.log(`eventopia server running on port ${port}`))