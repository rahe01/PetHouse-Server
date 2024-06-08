const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174" , 'https://peticaa.web.app', 'https://peticaa.firebaseapp.com/'],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  console.log(token);
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ncq0h0t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;   
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const usersCollection = client.db("Petenica").collection("users");
    const petsCollection = client.db("Petenica").collection("pets");
    const donationsCollection = client.db("Petenica").collection("donations");
    const adoptCollection = client.db("Petenica").collection("adopt");
    const donateCollection = client.db("Petenica").collection("donate");
       // verify admin middlewere
       const verifyAdmin = async (req, res, next) => {
        const user = req.user;
        const query = { email: user?.email };
        const result = await usersCollection.findOne(query);
        if (!result || result?.role !== "admin") {
          return res.status(403).send({ message: "forbidden access" });
        }
        next();
      };
      // verify host middlewere
      const verifyUser = async (req, res, next) => {
        const user = req.user;
        const query = { email: user?.email };
        const result = await usersCollection.findOne(query);
        if (!result || result?.role !== "user") {
          return res.status(403).send({ message: "forbidden access" });
        }
        next();
      };
  
    // auth related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // save user data in db

    app.put("/user", verifyToken, async (req, res) => {
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

    app.post("/pets",     async (req, res) => {
      const pet = req.body;
      const result = await petsCollection.insertOne(pet);
      res.send(result);
    });

    // get pets by email

    app.get("/my-pets/:email", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        const query = { userEmail: email };
        const result = await petsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // update pets

    app.get("/pets/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const pet = await petsCollection.findOne(filter);
      if (!pet) {
        return res.status(404).send({ message: "Pet not found" });
      }
      res.send(pet);
    });

    app.put("/pets/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: req.body };
      const result = await petsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // delet pet
    app.delete("/pets/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await petsCollection.deleteOne(query);
      res.send(result);
    });

    // add donation-campaigns
    app.post("/donation-campaigns", verifyToken,  async (req, res) => {
      const donation = req.body;
      const result = await donationsCollection.insertOne(donation);
      res.send(result);
    });

    // get donation-campaigns by email

    app.get("/donation-campaigns/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await donationsCollection.find(query).toArray();
      res.send(result);
    });

    // get donation-campaigns by id
    app.get("/donation-campaigns/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const donation = await donationsCollection.findOne(filter);
      if (!donation) {
        return res.status(404).send({ message: "Donation not found" });
      }
      res.send(donation);
    });

    //  not adopted pet api

    app.get("/notadopted", async (req, res) => {
      try {
        const result = await petsCollection
          .find({ adopted: "false" })
          .toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching not adopted pets:", error);
        res.status(500).send("Error fetching not adopted pets");
      }
    });

    // get pet by id

    app.get("/petsss/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const pet = await petsCollection.findOne(filter);
      if (!pet) {
        return res.status(404).send({ message: "Pet not found" });
      }
      res.send(pet);
    });

    // adopt data save and adopted: true in pet collection

    app.post("/adoptting", async (req, res) => {
      const adopt = req.body;
      // update adopted: true in pets collection
      const filter = { _id: new ObjectId(adopt.petId) };
      const updateDoc = { $set: { adopted: "request" } };
      const result = await petsCollection.updateOne(filter, updateDoc);
      // save adopt data in adopt collection
      const result2 = await adoptCollection.insertOne(adopt);
      res.send(result2);
    });

    // get donatitons
    app.get("/donationsss", async (req, res) => {
      const result = await donationsCollection.find({}).toArray();
      res.send(result);
    });
    // get donation by id

    app.get("/donationsss/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const donation = await donationsCollection.findOne(filter);
      if (!donation) {
        return res.status(404).send({ message: "Donation not found" });
      }
      res.send(donation);
    });

    // payment
    // create-payment-intent
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const price = req.body.price;
      const priceInCent = parseFloat(price) * 100;
      if (!price || priceInCent < 1) return;
      // generate clientSecret
      const { client_secret } = await stripe.paymentIntents.create({
        amount: priceInCent,
        currency: "usd",
        // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
        automatic_payment_methods: {
          enabled: true,
        },
      });
      // send client secret as response
      res.send({ clientSecret: client_secret });
    });

    // post donate
    app.post("/donateeeee", async (req, res) => {
      const donation = req.body;
      const result = await donationsCollection.insertOne(donation);
      res.send(result);
    });

    // post user donate
    app.post("/user-donate", async (req, res) => {
      const donation = req.body;
      const result = await donateCollection.insertOne(donation);
      res.send(result);
    });

    // get user donate
    app.get("/user-donate", async (req, res) => {
      const result = await donationsCollection.find({}).toArray();
      res.send(result);
    });

    // get donation
    app.get("/donation-campaigns/:id", async (req, res) => {
      const id = req.params.id;
      const result = await donationsCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // edit donation
    app.put("/donation-campaignsss/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const donation = req.body;
      const option = { upsert: true };
      const updateDoc = {
        $set: {
          petName: donation.petName,

          petPicture: donation.petPicture,
          maxDonationAmount: donation.maxDonationAmount,
          lastDate: donation.lastDate,
          shortDescription: donation.shortDescription,
          longDescription: donation.longDescription,
        },
      };
      const result = await donationsCollection.updateOne(
        filter,
        updateDoc,
        option
      );
      res.send(result);
    });

    // get donate by email

    app.get("/my-donate/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await donateCollection.find(filter).toArray();
      res.send(result);
    });

    // delet my donate
    app.delete("/my-donate/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donateCollection.deleteOne(query);
      res.send(result);
    });

    // get /adoption-requests/${user.email}
    app.get("/adoption-requests/:email", async (req, res) => {
      const email = req.params.email;
      try {
        const filter = { userEmail: email };
        const pets = await petsCollection.find(filter).toArray();
        const petIds = pets.map((pet) => pet._id.toString());
        const requests = await adoptCollection
          .find({ petId: { $in: petIds } })
          .toArray();
        res.send(requests);
      } catch (error) {
        console.error("Error fetching adoption requests:", error);
        res.status(500).send("Error fetching adoption requests");
      }
    });

    // Accept an adoption request
    app.post("/adoption-requests/accept/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const request = await adoptCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!request) {
          res.status(404).send("Request not found");
          return;
        }
        const petId = request.petId;
        await petsCollection.updateOne(
          { _id: new ObjectId(petId) },
          { $set: { adopted: true } }
        );
        await adoptCollection.deleteMany({ petId: petId });
        res.send("Adoption request accepted");
      } catch (error) {
        console.error("Error accepting adoption request:", error);
        res.status(500).send("Error accepting adoption request");
      }
    });

    // Reject an adoption request
    app.post("/adoption-requests/reject/:id", async (req, res) => {
      const id = req.params.id;

      try {
        // Find the adoption request to get the petId
        const request = await adoptCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!request) {
          res.status(404).send("Request not found");
          return;
        }

        const petId = request.petId;

        // Delete the adoption request
        const result = await adoptCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 0) {
          res.status(404).send("Request not found");
          return;
        }

        // Update the adoption status of the pet
        await petsCollection.updateOne(
          { _id: new ObjectId(petId) },
          { $set: { adopted: "false" } }
        );

        res.send("Adoption request rejected");
      } catch (error) {
        console.error("Error rejecting adoption request:", error);
        res.status(500).send("Error rejecting adoption request");
      }
    });

    //
    // get user email from db
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    // get all user
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find({}).toArray();
      res.send(result);
    });

    // update user role
    app.put("/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const option = { upsert: true };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc, option);
      res.send(result);
    });

    // all add pet
    app.get("/all-pets", verifyToken,verifyAdmin, async (req, res) => {
      const result = await petsCollection.find({}).toArray();
      res.send(result);
    });

    // delet pet
    app.delete("/all-pets/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await petsCollection.deleteOne(query);
      res.send(result);
    });

    // Update pet adoption status
    app.put("/all-pets/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body; // Expecting "true" or "false" as a string
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          adopted: status,
        },
      };
      const result = await petsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // get all donation
    app.get("/all-donationsssssssss", verifyToken,verifyAdmin, async (req, res) => {
      const result = await donationsCollection.find({}).toArray();
      res.send(result);
    });

    // Toggle pause status of a donation
    app.put("/donationssssssssssss/:id", async (req, res) => {
      const { id } = req.params;
      const donation = await donationsCollection.findOne({
        _id: new ObjectId(id),
      });

      if (donation) {
        const newStatus = !donation.paused;
        const result = await donationsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { paused: newStatus } }
        );
        res.send({ success: true, paused: newStatus });
      } else {
        res.status(404).send({ success: false, message: "Donation not found" });
      }
    });




    // delet donation
    app.delete("/all-donationsssssssss/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationsCollection.deleteOne(query);
      res.send(result);
    });

    // get donation by id
    app.get("/donation-camssssss/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationsCollection.findOne(query);
      res.send(result);
    });

     // edit donation
     app.put("/donation-cam/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const donation = req.body;
      const option = { upsert: true };
      const updateDoc = {
        $set: {
          petName: donation.petName,

          petPicture: donation.petPicture,
          maxDonationAmount: donation.maxDonationAmount,
          lastDate: donation.lastDate,
          shortDescription: donation.shortDescription,
          longDescription: donation.longDescription,
        },
      };
      const result = await donationsCollection.updateOne(
        filter,
        updateDoc,
        option
      );
      res.send(result);
    });


    // Logout
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
        console.log("Logout successful");
      } catch (err) {
        res.status(500).send(err);
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from  Server..");
});

app.listen(port, () => {
  console.log(`is running on port ${port}`);
});
