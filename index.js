const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())




const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gpnehvx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    const usersCollection = client.db('bloodDonate').collection('users')
    const DonationCollection = client.db('bloodDonate').collection('donation-req')
    const BlogsCollection = client.db('bloodDonate').collection('blogs')
    const FundsCollection = client.db('bloodDonate').collection('fund')
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();


    //JWT API
    app.post('/jwt', async (req, res) => {

      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })
    })

    //Middleware

    const verityToken = (req, res, next) => {
      // console.log('Inside THe verify Token',req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'Unauthorized access' })
      }
      const token = req.headers.authorization.split(' ')[1]
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next()
      })
    }

    //Verify Admin 
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      console.log(email);
      const query = { email: email }
      console.log(query);
      const user = await usersCollection.findOne(query)
      console.log(user);
      const isAdmin = user.role === 'admin'
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next()
    }

    //Verify volunteer
    const verifyVulanteer = async (req, res, next) => {
      const email = req.decoded.email;
      console.log(email);
      const query = { email: email }
      console.log(query);
      const user = await usersCollection.findOne(query)
      console.log(user);
      const isAdmin = user.role === 'volunteer'
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next()
    }


    //Create Payment Intent
    app.post('/create-payment-intent', verityToken, async (req, res) => {
      const { price } = req.body;
      console.log(price);
      const priceCent = parseFloat(price) * 100;
      if (!price || priceCent < 1) return

      const { client_secret } = await stripe.paymentIntents.create({
        amount: priceCent,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });
      console.log(client_secret);
      res.send({ clientSecret: client_secret });

    });

    //Save fund Details
    app.post('/fund-details', verityToken, async (req, res) => {
      const fund = req.body;
      const result = await FundsCollection.insertOne(fund)
      res.send(result)
    })
    //Show All Funding
    app.get('/fund-all', verityToken, async (req, res) => {
      const result = await FundsCollection.find().toArray()
      res.send(result)
    })



    app.put('/user', async (req, res) => {
      const user = req.body;
      const query = { email: user?.email }
      const option = { upsert: true }
      const updateDoc = {
        $set: {
          ...user,
        }
      }
      const result = await usersCollection.updateOne(query, updateDoc, option)
      res.send(result)
    })

    app.patch('/updateuser/:email', verityToken, async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email: email }
      const updatedoc = {
        $set: { ...user },
      }
      const result = await usersCollection.updateOne(query, updatedoc)
      res.send(result)
    })

    app.get('/user/:email', verityToken, async (req, res) => {
      const email = req.params?.email;
      const query = { email: email }
      const result = await usersCollection.findOne(query)
      res.send(result)
    })

    //For Role
    app.get('/userRole/:email', verityToken, async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email })
      res.send(result)
    })

    //Donation Create Request
    app.post('/create-donation-request', verityToken, async (req, res) => {
      const donReq = req.body;
      donReq.createdAt = new Date()
      const result = await DonationCollection.insertOne(donReq)
      res.send(result)
    })


    //show the data
    app.get('/create-donation-request/:email', verityToken, async (req, res) => {
      const email = req.params.email;
      const query = { RequestEmail: email }

      const result = await DonationCollection.find(query).sort({ createdAt: -1 }).toArray()
      res.send(result)
    })
    app.get('/create-donation-request-all/:email', verityToken, async (req, res) => {
      const email = req.params.email;
      const size = parseInt(req.query.size);
      let page = parseInt(req.query.page) - 1;
      const filter = req.query.filter;
      page = Math.max(0, page);
      const query1 = { RequestEmail: email };
      const query2 = filter ? { status: filter } : {};
      const result = await DonationCollection.find({ $and: [query1, query2] })
        .sort({ createdAt: -1 })
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    //Find user
    app.get('/finduser/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email }
      const result = await usersCollection.find(query).toArray()
      res.send(result)
    })


    //show the data
    app.get('/donation-request-count/:email', verityToken, async (req, res) => {
      const email = req.params.email;
      const filter = req.query.filter;
      const query1 = { RequestEmail: email };
      const query2 = filter ? { status: filter } : {};
      const count = await DonationCollection.countDocuments({ $and: [query1, query2] })
      res.send({ count })
    })


    //Showing for Details
    app.get('/DonationDetails/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await DonationCollection.findOne(query)
      res.send(result)
    })


    //Showing for update
    app.get('/reqUpdate/:id', verityToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await DonationCollection.findOne(query)
      res.send(result)
    })

    //Update Request 
    app.patch('/updatereq/:id', verityToken, async (req, res) => {
      const id = req.params.id
      const reqt = req.body;
      const query = { _id: new ObjectId(id) }
      const updatedoc = {
        $set: { ...reqt },
      }
      const result = await DonationCollection.updateOne(query, updatedoc)
      res.send(result)
    })

    //Delete Request
    app.delete('/deletereq/:id', verityToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await DonationCollection.deleteOne(query)
      res.send(result)
    })

    //Update Status 
    app.patch('/updatestatus/:id', verityToken, async (req, res) => {
      const id = req.params.id
      const reqt = req.body;
      const query = { _id: new ObjectId(id) }
      const updatedoc = {
        $set: { ...reqt }
      }
      const result = await DonationCollection.updateOne(query, updatedoc)
      res.send(result)
    })

    //Update Status 
    app.patch('/donateupdatestatus/:id', async (req, res) => {
      const id = req.params.id
      const { status, DonationName, DonationEmail } = req.body;
      const query = { _id: new ObjectId(id) }
      const updatedoc = {
        $set: {
          status: status,
          DonationName: DonationName,
          DonationEmail: DonationEmail
        }
      }
      const result = await DonationCollection.updateOne(query, updatedoc)
      res.send(result)
    })
    //Showing for Donation req to the all donor
    app.get('/publicDonor', async (req, res) => {
      const result = await DonationCollection.find().sort({ createdAt: -1 }).toArray()
      res.send(result)
    })

    //Admin 
    //All Users
    app.get('/allusers', verityToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })
    //Update Role 
    app.patch('/users/update/:email', verityToken, async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email }
      const updateDoc = {
        $set: {
          ...user, timestamp: Date.now()
        }
      }
      const result = await usersCollection.updateOne(query, updateDoc)
      res.send(result)
    })

      //Update Status
      app.patch('/adminupdatestatus/:id', verityToken, verifyAdmin, async (req, res) => {
        const id = req.params.id
        const reqt = req.body;
        const query = { _id: new ObjectId(id) }
        const updatedoc = {
          $set: { ...reqt }
        }
        const result = await usersCollection.updateOne(query, updatedoc)
        res.send(result)
      })

      //show the data admin
      app.get('/create-donation-request', verityToken, verifyAdmin, async (req, res) => {
        const result = await DonationCollection.find().sort({ createdAt: -1 }).toArray()
        res.send(result)
      })
      //show the data vol
      app.get('/vol-create-donation-request', verityToken, verifyVulanteer, async (req, res) => {
        const result = await DonationCollection.find().sort({ createdAt: -1 }).toArray()
        res.send(result)
      })
  
       //Count
       app.get('/count', verityToken, async (req, res) => {
        const query = { role: 'donor' }
        const Donorcount = await usersCollection.countDocuments(query)
        const Donationcount = await DonationCollection.countDocuments()
        const result = await FundsCollection.aggregate([
          {
            $addFields: {
              fundNumeric: { $toDouble: "$fund" }
            }
          },
          {
            $group: {
              _id: null,
              totalFund: {
                $sum: "$fundNumeric"
              }
            }
          }
        ]).toArray();
  
        const fund = result.length > 0 ? result[0].totalFund : 0;
        res.send({ Donationcount ,Donorcount,fund });
  
      });

      //Blog
      app.post('/blogpost', verityToken, async (req, res) => {
        const blog = req.body;
        const result = await BlogsCollection.insertOne(blog)
        res.send(result)
      })
  
    


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Assignmnet-12 is running')
})

app.listen(port, () => {
  console.log(`Assignmnet-12 is running on ${port}`);
})