require('dotenv').config()
const express = require('express')
const app = express()

const cors = require('cors')
app.use(cors({origin: 'http://localhost:3000'}))
// parse application/json
app.use(express.json({limit: '3.5mb'}))
console.log("Server Started!")

//  const mysql = require('mysql2')
//      const connection = mysql.createConnection(process.env.DATABASE_URL)
// app.post(('/createUsers'), async (req, res) => {
//     try {
//         const query = "CREATE TABLE Users(email VARCHAR(255) PRIMARY KEY, username VARCHAR(100), photo_url VARCHAR(255));"
//         connection.query(query)
//         res.send("success")
//     }
//     catch (err) {
//         console.log(err)
//     }
// })

// app.post(('/insertUser'), (req, res) => {
//     try {
//         const query = "INSERT INTO Users VALUES ('alex', 'D4rkP1xel', 'www.photourl.com');"
//         connection.query(query)
//         res.send("success")
//     }
//     catch (err) {
//         console.log(err)
//     }
// })

// const router = require('./Routes/route')
// app.use('/path', router)
const imagesRoute = require("./Routes/images")
app.use("/images", imagesRoute)
const userRoute = require("./Routes/user")
app.use("/user", userRoute)
app.listen(process.env.PORT || 3001)