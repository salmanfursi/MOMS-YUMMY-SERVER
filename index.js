const express=require("express")
const jwt = require('jsonwebtoken');
const app=express()
const cors=require('cors')
require('dotenv').config()

const helmet = require('helmet');

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port =process.env.port || 5000
//middlware
app.use(cors())
app.use(express.json())

// app.use(helmet({
//   contentSecurityPolicy: {
//     directives: {
//       imgSrc: ['self', 'data:image/x-icon;base64', 'data:image/png;base64', 'data:image/jpeg;base64'],
//     },
//   },
// }));

//jwt varify funciton
const varifyJWT=(req ,res,next)=>{
  const authorization=req.headers.authorization
  // console.log(authorization);
  
  if(!authorization){
    res.status(401).send({error:true,massage:"unauthorized access"})
  }
  // extract the actual token without bearar
  const token=authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=> {
    if(err){
      res.status(401).send({error:true,massage:"unauthorized access"})
    }
    
    req.decoded=decoded
    next()
  });

}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@momsyummy.fexfrtg.mongodb.net/?retryWrites=true&w=majority`;


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
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

//collections
    const menuCollection = client.db("momsDB").collection("menu");
    const usersCollection = client.db("momsDB").collection("users");
    const reviewCollection = client.db("momsDB").collection("reviews");
    const cartCollection = client.db("momsDB").collection("carts");
    

    //use varifyJWR before using varifyadmin cause you need decoded.email
    const varifyAdmin= async (req ,res,next)=>{
      const email=req.decoded.email
      const query={email:email}
      const user =await usersCollection.findOne(query)
      if(user.role !== 'admin'){
        res.status(403).send({error:true,massage:"forbidden access"});
       }
      next()
    }

    //jwt
    app.post('/jwt', (req,res) => {
      const user=req.body
      const token=jwt.sign(
        user,
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn:'24h' }
        )
    
      res.send({token})
    })
/**
 * make secure with
 * jwt token like varifyJWR middlware
 * axios secure mane localhost er token header e diya api e patiye tarpor
 * server er token er sate check korbe
 * 
 * 
 * 
 */
    // Users related api varifyJWT,varifyAdmin,
    app.get('/users',async(req,res)=>{
      const result = await usersCollection.find().toArray()

      res.send(result)
    })

    app.post('/users', async(req,res)=>{
      const user=req.body
      const query={name:user.name,email:user.email}
      const existingUser=await usersCollection.findOne(query)
      if(existingUser){
        return res.send({massage:'user already exist'})
      }
      const result = await usersCollection.insertOne(user)
      res.send(result)
    })

    //security layer varifyJWT
    //jwt decoded email and own email
    //checking is admin or not

    app.get('/users/admin/:email', varifyJWT,async(req,res)=>{
      const email=req.params.email
      const query ={email:email}
      
      if(req.decoded.email !== email){
    
        res.send({admin:false})
      }
      const user = await usersCollection.findOne(query);
      
      const result={admin:user?.role === "admin" }
      // ? true : false
      

      res.send(result)
    })

    app.get('/users/admin/:email', varifyJWT, async (req, res) => {
      try {
        const email = req.params.email;
        const query = { email: email };
    
        // Ensure that only the user associated with the JWT token can access this information
        if (req.decoded.email !== email) {
          return res.send({ admin: false });
        }
    
        // Retrieve the user with the specified email
        const user = await usersCollection.findOne(query);
    
        // Check if the user exists and has an admin role
        const result = { admin: user?.role === "admin" };
    
      
        res.send(result);
      } catch (error) {
 
        res.status(500).send({ error: 'Internal Server Error' });
      }
    });
    
    
    app.patch('/users/admin/:id',async(req,res)=>{
      const id=req.params.id
      const filter={_id:new ObjectId(id)}
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result)
    })
    
    //menu related apis
    app.get('/menu',async(req,res)=>{
      const result = await menuCollection.find().toArray()

      res.send(result)
    })

    app.post('/menu',varifyJWT,varifyAdmin,async (req,res)=>{
      const newItem=req.body
      const result=await menuCollection.insertOne(newItem);
      res.send(result)
    })

    app.delete('/menu/:id',varifyJWT,varifyAdmin,async(req,res)=>{
      const id=req.params.id
      const query={_id:new ObjectId(id)}

      const result = await menuCollection.deleteOne(query);
      res.send(result)
    })

    //review related api
    app.get('/review',async(req,res)=>{
      const result = await reviewCollection.find().toArray()

      res.send(result)
    })

    //cart related collection
    app.post('/carts',async(req,res)=>{
      const item=req.body
      const result = await cartCollection.insertOne(item)

      res.send(result)
    })
    app.get('/carts',varifyJWT,async(req,res)=>{
      const email=req.query.email
      if(!email){
        res.send([])
      }

      const decodedEmail=req.decoded.email
      if(decodedEmail !== email){
       res.status(403).send({error:true,massage:"forbidden access"});
      }

      const query={email:email}
      const result = await cartCollection.find(query).toArray()
    
      res.send(result)
    })
    
    //delete api
    app.delete('/carts/:id',async(req,res)=>{
      const id=req.params.id
      const query={_id:new ObjectId(id)}

      const result = await cartCollection.deleteOne(query);
      res.send(result)
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


app.get('/',(req,res)=>{
  res.send('moms busy to cooking yummy')
})
app.listen(port,(req,res)=>{
  console.log(`moms server running on port ${port}`)

})
