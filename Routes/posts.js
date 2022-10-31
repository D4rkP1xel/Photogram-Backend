const router = require('express').Router()
const mysql = require('mysql2/promise')
//INSERT INTO POSTS VALUES('abc','abc','abc','1','abc', UTC_TIMESTAMP);
const cloudinary = require('cloudinary')

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

router.get("/user/:id", async (req, res) => {

    const user_id = req.params.id
    console.log(req.params.id)
    const connection = await mysql.createConnection(process.env.DATABASE_URL)
    const query = `SELECT * FROM POSTS WHERE user_id='${user_id}';`
    const [rows] = await connection.query(query)
    console.log(rows)
    res.status(200).json({ message: "success", data: rows })
})

router.post("/newPost", async (req, res) => {
    console.log(req.body)
    if (req.body.image == null || req.body.description == undefined || req.body.user_id == null || req.body.tags == undefined) {
        res.status(403).json({ message: "ERROR: wrong params", })
        return
    }
    try {
        const base64Image = req.body.image
        const uploadedResponse = await cloudinary.v2.uploader.upload(base64Image, { upload_preset: "preset_user_photo" })
        const photo_url = uploadedResponse.secure_url
        const connection = await mysql.createConnection(process.env.DATABASE_URL)
        const id = Date.now().toString() + Math.floor(Math.pow(10, 12) + Math.random() * 9 * Math.pow(10, 12)).toString(36) //post id -> lenght 22
        const query = `INSERT INTO POSTS VALUES ('${req.body.user_id}', 1, '${photo_url}', UTC_TIMESTAMP, '${id}'); `
        await connection.query(query)
        const insertTagQuery = `INSERT INTO TAGS VALUES ${req.body.tags.map((tag)=>{return `('${id}', '${tag.toLowerCase()}')`})} `
        await connection.query(insertTagQuery)
        const insertDescriptionQuery = `INSERT INTO POSTS_DESCRIPTION VALUES('${id}','${req.body.description}');`
        await connection.query(insertDescriptionQuery)
        res.status(200).json({message: "success"})
    }
    catch (err) {
        console.log(err)
        res.status(503).json({message: "ERROR: Server error"})
    }

})
module.exports = router