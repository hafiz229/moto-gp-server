const express = require("express");
const app = express();
const cors = require("cors");
// firebase admin sdk (jwt)
const admin = require("firebase-admin");
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient } = require("mongodb");
const ObjectId = require("mongodb").ObjectId;

// firebase admin sdk (jwt)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// verifyToken (jwt)
async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers.authorization.split(" ")[1];

    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }
  next();
}

//middleware
app.use(cors());
app.use(express.json());

// add connection string
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5rymw.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// async function
async function run() {
  try {
    await client.connect();
    console.log("Database Connection is OK");
    const database = client.db("motoGP_DB");
    const productsCollection = database.collection("products");
    const usersCollection = database.collection("users");
    const ordersCollection = database.collection("orders");
    const reviewsCollection = database.collection("reviews");

    // get all products from products collection (Home/Explore)
    app.get("/products", async (req, res) => {
      // console.log("Get Request is Send, Products");
      const cursor = productsCollection.find({});
      const size = parseInt(req.query?.size);
      let products;
      if (size === 6) {
        products = await cursor.limit(size).toArray();
      } else {
        products = await cursor.toArray();
      }
      res.send(products);
    });

    // get all reviews from reviews collection (Home)
    app.get("/reviews", async (req, res) => {
      // console.log("Get Request is Send, Reviews");
      const cursor = reviewsCollection.find({});
      const reviews = await cursor.toArray();
      res.send(reviews);
    });

    // post a new product to the products collection (Add Products)
    app.post("/products", async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      // console.log(result);
      res.json(result);
    });

    // post a new review to the reviews collection (User Review)
    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      // console.log(result);
      res.json(result);
    });

    // get a single product details from the products collection (Booking)
    app.get("/products/:id", async (req, res) => {
      // console.log("Get Request is Send, Single Product");
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const product = await productsCollection.findOne(query);
      res.json(product);
    });

    // delete a product from the products collection (Manage Products)
    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      console.log(result);
      res.json(result);
    });

    // delete a order from the orders collection (My Orders)
    app.delete("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await ordersCollection.deleteOne(query);
      console.log(result);
      res.json(result);
    });

    // get my orders & all orders from the orders collection (My Orders/All Orders)
    app.get("/orders", verifyToken, async (req, res) => {
      // console.log("Get Request is Send, My Orders");
      const email = req.query.email;
      const query = { email: email };
      let cursor;
      if (req.complete === true) {
        cursor = ordersCollection.find(query);
      } else {
        cursor = ordersCollection.find({});
      }
      const orders = await cursor.toArray();
      res.json(orders);
    });

    // post a new order to the orders collection (Booking)
    app.post("/orders", async (req, res) => {
      const order = req.body;
      const result = await ordersCollection.insertOne(order);
      console.log(result);
      res.json(result);
    });

    // get whether an user is Admin or not (useFirebase => Dashboard)
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });

    // post a new user to users collection (Register)
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      console.log(result);
      res.json(result);
    });

    // update an order status if it's not approved yet (Manage All Orders)
    app.put("/orders/:id", async (req, res) => {
      const order = req.body;
      // console.log(req.body);
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const updateDoc = { $set: order };
      const result = await ordersCollection.updateOne(filter, updateDoc);
      res.json(result);
    });

    // update a user only if it's not included in the collections (Google Sign In)
    app.put("/users", async (req, res) => {
      const user = req.body;
      console.log("put", user);
      // filter here is same as query
      const filter = { email: user.email };
      const options = { upsert: true };
      // updateDoc means what to update
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.json(result);
    });

    // update user as admin (jwt) (Make Admin)
    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      // update for jwt token
      const requester = req.decodedEmail;
      if (requester) {
        const requesterAccount = await usersCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          const filter = { email: user.email };
          const updateDoc = { $set: { role: "admin" } };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      } else {
        res
          .status(403)
          .json({ message: "You do not have access to make admin" });
      }
    });
  } finally {
    //   await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello MotoGP!");
});

app.listen(port, () => {
  console.log(`listening at ${port}`);
});
