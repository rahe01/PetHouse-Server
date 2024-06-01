const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')

const port = process.env.PORT || 5000

// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

app.use(express.json())
app.use(cookieParser())

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token
  console.log(token)
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err)
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
    next()
  })
}

const uri =  `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ncq0h0t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {

    const usersCollection = client.db("Petenica").collection("users");
    const petsCollection = client.db("Petenica").collection("pets");
    // auth related api
    app.post('/jwt', async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })

      // save user data in db

      app.put("/user", async (req, res) => {
        const user = req.body;
        const query = { email: user?.email };
  
        const isExist = await usersCollection.findOne(query);
        if (isExist) {
          if (user.status === "Requested") {
            const result = await usersCollection.updateOne(query, {
              $set: { status: user?.status },
            });
            return res.send(result);
          } else {
            return res.send(isExist);
          }
        }
  
        const option = { upsert: true };
  
        const updateDoc = {
          $set: {
            ...user,
            timeStamp: Date.now(),
          },
        };
        const result = await usersCollection.updateOne(query, updateDoc, option);
        res.send(result);
      });


      // save pet in db

      app.post("/pets", async (req, res) => {
        const pet = req.body;
        const result = await petsCollection.insertOne(pet);
        res.send(result);
      });

      app.get("/pets/:email", async (req, res) => {
        const email = req.params.email;
        const query = { email: email };
        const result = await petsCollection.find(query).toArray();
        res.send(result);
      })




















    // Logout
    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true })
        console.log('Logout successful')
      } catch (err) {
        res.status(500).send(err)
      }
    })

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from StayVista Server..')
})

app.listen(port, () => {
  console.log(`StayVista is running on port ${port}`)
})
