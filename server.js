require('dotenv').config()
const express = require('express')
const app = express()

const cors = require('cors')
app.use(cors({origin: ['http://localhost:3000', 'https://photogram-bay.vercel.app']}))

// parse application/json
app.use(express.json({limit: '3.5mb'}))
console.log("Server Started!")
// const router = require('./Routes/route')
// app.use('/path', router)
const imagesRoute = require("./Routes/images")
app.use("/images", imagesRoute)
const userRoute = require("./Routes/user")
app.use("/user", userRoute)
const postsRoute = require("./Routes/posts")
app.use("/posts", postsRoute)
app.listen(process.env.PORT || 3001)