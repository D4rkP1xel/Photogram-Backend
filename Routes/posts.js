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
    const query = `SELECT * FROM POSTS WHERE user_id='${user_id}' ORDER BY date DESC;`
    const [rows] = await connection.query(query)
    console.log(rows)
    res.status(200).json({ message: "success", data: rows })
})

router.post("/newPost", async (req, res) => {
    console.log(req.body)
    if (req.body.image == null || req.body.description == undefined || req.body.user_id == null || req.body.tags == undefined) {
        res.status(403).json({ message: "ERROR: wrong params" })
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
        if(req.body.tags.length > 0)
        {
            const insertTagQuery = `INSERT INTO TAGS VALUES ${req.body.tags.map((tag) => { return `('${id}', '${tag.toLowerCase()}')` })} `
            await connection.query(insertTagQuery)
        }
        
        const insertDescriptionQuery = `INSERT INTO POSTS_DESCRIPTION VALUES('${id}','${req.body.description}');`
        await connection.query(insertDescriptionQuery)
        res.status(200).json({ message: "success" })
    }
    catch (err) {
        console.log(err)
        res.status(503).json({ message: "ERROR: Server error" })
    }

})

router.post("/getPost", async(req, res) => {
    if (req.body.post_id === undefined || req.body.post_id.length > 22) {
        res.status(403).json({ message: "ERROR: wrong params" })
        return
    }
    const connection = await mysql.createConnection(process.env.DATABASE_URL)
    const checkPostQuery = `SELECT POSTS.id AS id, POSTS.photo_url AS photo_url, POSTS.date as date, POSTS.user_id as author_id, Users.username AS author_username, Users.photo_url AS author_photo_url, POSTS_DESCRIPTION.description AS description FROM POSTS INNER JOIN Users ON POSTS.user_id = Users.id LEFT JOIN POSTS_DESCRIPTION ON POSTS.id = POSTS_DESCRIPTION.post_id WHERE POSTS.id='${req.body.post_id}';`
    const checkPostResponse = await connection.query(checkPostQuery)
    if(checkPostResponse[0].length !== 1)
    {
        res.status(403).json({ message: "ERROR: post doesn't exist" })
        return
    }
    console.log( checkPostResponse[0][0])
    res.status(200).json({message: "success", data: checkPostResponse[0][0]})

})

router.post("/addComment", async(req,res)=>{
    if(req.body.comment == null || req.body.comment.length > 400 || req.body.isFromPost == null || req.body.parentId == null || req.body.user_id == null)
    {
        res.status(403).json({ message: "ERROR: wrong params" })
        return
    }
    try 
    {
        const connection = await mysql.createConnection(process.env.DATABASE_URL)
        const checkUserQuery = `SELECT id FROM Users WHERE id='${req.body.user_id}'`
        const checkUserResponse = await connection.query(checkUserQuery)
        if(checkUserResponse[0].length !== 1)
        {
            res.status(403).json({ message: "ERROR: user who commented doesn't exist" })
                return
        }
        const id = Date.now().toString() + Math.floor(Math.pow(10, 12) + Math.random() * 9 * Math.pow(10, 12)).toString(36)
        if(req.body.isFromPost === true)
        {
            const checkPostQuery = `SELECT id FROM POSTS WHERE id = '${req.body.parentId}'`
            const response = await connection.query(checkPostQuery)
            if(response[0].length !== 1)
            {
                res.status(403).json({ message: "ERROR: post accessed doesn't exist" })
                return
            }
        }
        else // is a comment on a comment
        {
            const checkCommentQuery = `SELECT id FROM COMMENTS WHERE id = '${req.body.parentId}'`
            const response = await connection.query(checkCommentQuery)
            if(response[0].length !== 1)
            {
                res.status(403).json({ message: "ERROR: comment accessed doesn't exist" })
                return
            }
        }
        const query = `INSERT INTO COMMENTS VALUES('${id}', '${req.body.comment}', ${req.body.isFromPost ? 1 : 0}, '${req.body.parentId}', '${req.body.user_id}', UTC_TIMESTAMP);`
        await connection.query(query)
        res.status(200).json({ message: "success" })
    } 
    catch (error) {
        console.log(error)
        res.status(503).json({ message: "ERROR: Server error" })
    }
})

router.post("/getComments", async(req, res)=>{
if(req.body.post_id === undefined || req.body.post_id > 22)
{
    res.status(403).json({ message: "ERROR: wrong params" })
    return
}
try 
{
    const connection = await mysql.createConnection(process.env.DATABASE_URL)
    const checkPostQuery = `SELECT id FROM POSTS WHERE id='${req.body.post_id}'`
    const response = await connection.query(checkPostQuery)
    if(response[0].length !== 1)
    {
        res.status(403).json({ message: "ERROR: post accessed doesn't exist" })
        return
    }
    const getCommentsQuery = `SELECT COMMENTS.id as id, COMMENTS.text AS text, COMMENTS.is_from_post AS is_from_post, COMMENTS.parent_id AS parent_id, COMMENTS.date AS date, COMMENTS.user_id AS user_id, Users.photo_url AS user_photo_url, Users.username AS user_username FROM COMMENTS INNER JOIN Users ON COMMENTS.user_id = Users.id WHERE parent_id='${req.body.post_id}' AND is_from_post=1 `
    // add a count to show the number of replies each comment has, but don't send them to save data. Only get those comments with a new route
    const comments = await connection.query(getCommentsQuery)
    console.log(comments[0])
    res.status(200).json({ message: "success", data: comments[0]})
} 
catch (error) {
    console.log(error)
    res.status(503).json({ message: "ERROR: Server error" })
}

})
module.exports = router