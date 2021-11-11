const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient } = require("mongodb");

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

    // GET API (get all products)
    app.get("/products", async (req, res) => {
      console.log("Get Request is Send");
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
