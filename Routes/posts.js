const router = require('express').Router()
const cloudinary = require('cloudinary')
const mysql = require('mysql2/promise')
//INSERT INTO POSTS VALUES('abc','abc','abc','1','abc', UTC_TIMESTAMP);

router.get("/user/:id", async(req, res) =>{
  
    const user_id = req.params.id
    console.log(req.params.id)
    const connection = await mysql.createConnection(process.env.DATABASE_URL)
    const query = `SELECT * FROM POSTS WHERE user_id='${user_id}';`
    const [rows] = await connection.query(query)
    console.log(rows)
    res.status(200).json({message:"success", data: rows})
})
module.exports = router