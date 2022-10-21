require('dotenv').config()
const express = require('express')
const app = express()

const cors = require('cors')
app.use(cors({origin: process.env.URL || 'http://localhost:3000'}))
// parse application/json
app.use(express.json({limit: '3.5mb'}))
console.log("Server Started!")


// const router = require('./Routes/route')
// app.use('/path', router)
const imagesRoute = require("./Routes/images")
app.use("/images", imagesRoute)
const userRoute = require("./Routes/user")
app.use("/user", userRoute)
app.listen(process.env.PORT || 3001)