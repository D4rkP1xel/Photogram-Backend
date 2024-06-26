const router = require('express').Router()
const mysql = require('mysql2/promise')
//INSERT INTO POSTS VALUES('abc','abc','abc','1','abc', UTC_TIMESTAMP);
const cloudinary = require('cloudinary')

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

router.post("/getPostsProfilePage", async (req, res) => {

    if (req.body.user_id == null || req.body.last_post_id === undefined) {
        res.status(403).json({ message: "ERROR: wrong params" })
        return
    }
    try {
        if (req.body.last_post_id === null) //first fetch => get most recent posts
        {
            const connection = await mysql.createConnection(process.env.DATABASE_URL)
            const query = `SELECT POSTS.id AS id, (SELECT COUNT(post_id) FROM POST_LIKES WHERE post_id=POSTS.id) AS num_likes, POSTS.user_id AS user_id, POSTS.is_public AS is_public, POSTS.photo_url AS photo_url, POSTS.date AS date, Users.username AS username, Users.photo_url AS user_photo_url, POSTS_DESCRIPTION.description AS description, (CASE WHEN (SELECT post_id FROM POST_LIKES WHERE post_id=POSTS.id AND user_id="${req.body.user_id}") IS NULL THEN 0 ELSE 1 END) AS is_liked, (SELECT COUNT(id) FROM COMMENTS WHERE parent_id=POSTS.id) AS num_comments 
            FROM POSTS 
            INNER JOIN Users ON POSTS.user_id = Users.id 
            LEFT JOIN POSTS_DESCRIPTION ON POSTS.id = POSTS_DESCRIPTION.post_id 
            WHERE POSTS.user_id = '${req.body.user_id}'
            ORDER BY date DESC
            LIMIT 9;`
            const response = await connection.query(query)
            //TODO verificacoes caso seja necessario also fazer INNER JOIN com user ids que segue
            res.status(200).json({ message: "success", posts: response[0] })
            return
        }
        const connection = await mysql.createConnection(process.env.DATABASE_URL)
        const checkPostQuery = `SELECT id FROM POSTS WHERE id="${req.body.last_post_id}"`
        const checkPostResponse = await connection.query(checkPostQuery)
        if (checkPostResponse[0].length !== 1) {
            res.status(403).json({ message: "ERROR: last_post_id is not found in the database" })
            return
        }
        const query = `SELECT POSTS.id AS id, (SELECT COUNT(post_id) FROM POST_LIKES WHERE post_id=POSTS.id) AS num_likes, POSTS.user_id AS user_id, POSTS.is_public AS is_public, POSTS.photo_url AS photo_url, POSTS.date AS date, Users.username AS username, Users.photo_url AS user_photo_url, POSTS_DESCRIPTION.description AS description, (CASE WHEN (SELECT post_id FROM POST_LIKES WHERE post_id=POSTS.id AND user_id="${req.body.user_id}") IS NULL THEN 0 ELSE 1 END) AS is_liked, (SELECT COUNT(id) FROM COMMENTS WHERE parent_id=POSTS.id) AS num_comments 
        FROM POSTS 
        INNER JOIN Users ON POSTS.user_id = Users.id 
        LEFT JOIN POSTS_DESCRIPTION ON POSTS.id = POSTS_DESCRIPTION.post_id 
        WHERE POSTS.date <= (SELECT date FROM POSTS WHERE id="${req.body.last_post_id}") 
        AND POSTS.id != "${req.body.last_post_id}" AND POSTS.user_id = '${req.body.user_id}'
        ORDER BY date DESC 
        LIMIT 10;`
        const response = await connection.query(query)
        res.status(200).json({ message: "success", posts: response[0] })
        //TODO acabar


    }
    catch (err) {
        console.log(err)
        res.status(503).json({ message: "ERROR: Server error" })
    }
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
        if (req.body.tags.length > 0) {
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

router.post("/getPost", async (req, res) => {
    if (req.body.post_id === undefined || req.body.post_id.length > 22) {
        res.status(403).json({ message: "ERROR: wrong params" })
        return
    }
    const connection = await mysql.createConnection(process.env.DATABASE_URL)
    const checkPostQuery = `SELECT POSTS.id AS id, POSTS.photo_url AS photo_url, POSTS.date as date, POSTS.user_id as author_id, Users.username AS author_username, Users.photo_url AS author_photo_url, POSTS_DESCRIPTION.description AS description, (SELECT COUNT(post_id) FROM POST_LIKES WHERE post_id='${req.body.post_id}') AS num_likes FROM POSTS INNER JOIN Users ON POSTS.user_id = Users.id LEFT JOIN POSTS_DESCRIPTION ON POSTS.id = POSTS_DESCRIPTION.post_id WHERE POSTS.id='${req.body.post_id}';`
    const checkPostResponse = await connection.query(checkPostQuery)
    if (checkPostResponse[0].length !== 1) {
        res.status(403).json({ message: "ERROR: post doesn't exist" })
        return
    }
    console.log(checkPostResponse[0][0])
    res.status(200).json({ message: "success", data: checkPostResponse[0][0] })

})

router.post("/addComment", async (req, res) => {
    if (req.body.comment == null || req.body.comment.length > 400 || req.body.isFromPost == null || req.body.parentId == null || req.body.user_id == null) {
        res.status(403).json({ message: "ERROR: wrong params" })
        return
    }
    try {
        const connection = await mysql.createConnection(process.env.DATABASE_URL)
        const checkUserQuery = `SELECT id FROM Users WHERE id='${req.body.user_id}'`
        const checkUserResponse = await connection.query(checkUserQuery)
        if (checkUserResponse[0].length !== 1) {
            res.status(403).json({ message: "ERROR: user who commented doesn't exist" })
            return
        }
        const id = Date.now().toString() + Math.floor(Math.pow(10, 12) + Math.random() * 9 * Math.pow(10, 12)).toString(36)
        if (req.body.isFromPost === true) {
            const checkPostQuery = `SELECT id FROM POSTS WHERE id = '${req.body.parentId}'`
            const response = await connection.query(checkPostQuery)
            if (response[0].length !== 1) {
                res.status(403).json({ message: "ERROR: post accessed doesn't exist" })
                return
            }
            const query = `INSERT INTO COMMENTS VALUES('${id}', '${req.body.comment}', '${req.body.parentId}', '${req.body.user_id}', UTC_TIMESTAMP);`
            await connection.query(query)
            res.status(200).json({ message: "success" })
            return
        }
        else // is a comment on a comment
        {
            const checkCommentQuery = `SELECT id FROM COMMENTS WHERE id = '${req.body.parentId}'`
            const response = await connection.query(checkCommentQuery)
            if (response[0].length !== 1) {
                res.status(403).json({ message: "ERROR: comment accessed doesn't exist" })
                return
            }

            const query = `INSERT INTO COMMENT_REPLY VALUES('${id}', '${req.body.comment}', '${req.body.parentId}', '${req.body.user_id}', UTC_TIMESTAMP);`
            await connection.query(query)
            res.status(200).json({ message: "success" })
            return
        }
    }
    catch (error) {
        console.log(error)
        res.status(503).json({ message: "ERROR: Server error" })
    }
})


router.post("/getComments", async (req, res) => {
    if (req.body.post_id === undefined || req.body.post_id.length > 22 || req.body.last_comment_id === undefined) {
        res.status(403).json({ message: "ERROR: wrong params" })
        return
    }
    try {
        const connection = await mysql.createConnection(process.env.DATABASE_URL)
        const checkPostQuery = `SELECT id FROM POSTS WHERE id='${req.body.post_id}'`
        const response = await connection.query(checkPostQuery)
        if (response[0].length !== 1) {
            res.status(403).json({ message: "ERROR: post accessed doesn't exist" })
            return
        }
        if (req.body.last_comment_id === null) //first fetch => get most recent comments
        {
            const getCommentsQuery = `SELECT COMMENTS.id as id, COMMENTS.text AS text, COMMENTS.parent_id AS parent_id, COMMENTS.date AS date, COMMENTS.user_id AS user_id, Users.photo_url AS user_photo_url, Users.username AS user_username, (SELECT COUNT(*) FROM COMMENT_REPLY WHERE comment_id=COMMENTS.id) AS num_replies
            FROM COMMENTS 
            INNER JOIN Users ON COMMENTS.user_id = Users.id 
            WHERE parent_id='${req.body.post_id}'
            ORDER BY COMMENTS.date DESC 
            LIMIT 10`
            // add a count to show the number of replies each comment has, but don't send them to save data. Only get those comments with a new route
            const comments = await connection.query(getCommentsQuery)
            res.status(200).json({ message: "success", comments: comments[0] })
            return
        }
        const getCommentsQuery = `SELECT COMMENTS.id as id, COMMENTS.text AS text, COMMENTS.parent_id AS parent_id, COMMENTS.date AS date, COMMENTS.user_id AS user_id, Users.photo_url AS user_photo_url, Users.username AS user_username , (SELECT COUNT(*) FROM COMMENT_REPLY WHERE comment_id=COMMENTS.id) AS num_replies
        FROM COMMENTS INNER JOIN Users ON COMMENTS.user_id = Users.id
        WHERE COMMENTS.date <= (SELECT date FROM COMMENTS WHERE id="${req.body.last_comment_id}") 
        AND COMMENTS.id != "${req.body.last_comment_id}" AND parent_id='${req.body.post_id}' ORDER BY COMMENTS.date DESC LIMIT 10`
        const comments = await connection.query(getCommentsQuery)
        res.status(200).json({ message: "success", comments: comments[0] })
    }
    catch (error) {
        console.log(error)
        res.status(503).json({ message: "ERROR: Server error" })
    }

})

router.post("/getCommentReplies", async (req, res) => {
    if (req.body.comment_id.length > 22 || req.body.last_reply_id === undefined) {
        res.status(403).json({ message: "ERROR: wrong params" })
        return
    }
    try {

        const connection = await mysql.createConnection(process.env.DATABASE_URL)
        const checkCommentQuery = `SELECT id FROM COMMENTS WHERE id='${req.body.comment_id}'`
        const response = await connection.query(checkCommentQuery)
        if (response[0].length !== 1) {
            res.status(403).json({ message: "ERROR: comment accessed doesn't exist" })
            return
        }
        if (req.body.last_reply_id === null) 
        {
            const getRepliesQuery = `SELECT COMMENT_REPLY.id AS id, COMMENT_REPLY.text AS text, COMMENT_REPLY.comment_id AS comment_id, COMMENT_REPLY.user_id AS user_id, (SELECT username FROM Users WHERE id=COMMENT_REPLY.user_id) AS user_username, (SELECT photo_url FROM Users WHERE id=COMMENT_REPLY.user_id) AS user_photo_url, COMMENT_REPLY.date AS date 
            FROM COMMENT_REPLY 
            WHERE comment_id='${req.body.comment_id}' 
            ORDER BY DATE DESC 
            LIMIT 6`
            const replies = await connection.query(getRepliesQuery)
            res.status(200).json({ message: "success", comments: replies[0] })
        }
        else {
            const getRepliesQuery = `SELECT COMMENT_REPLY.id AS id, COMMENT_REPLY.text AS text, COMMENT_REPLY.comment_id AS comment_id, COMMENT_REPLY.user_id AS user_id, (SELECT username FROM Users WHERE id=COMMENT_REPLY.user_id) AS user_username, (SELECT photo_url FROM Users WHERE id=COMMENT_REPLY.user_id) AS user_photo_url, COMMENT_REPLY.date AS date 
            FROM COMMENT_REPLY 
            WHERE DATE<=(SELECT DATE FROM COMMENT_REPLY WHERE id='${req.body.last_reply_id}') 
            AND comment_id='${req.body.comment_id}' 
            AND id != '${req.body.last_reply_id}'  
            ORDER BY DATE DESC 
            LIMIT 6`
            const replies = await connection.query(getRepliesQuery)
            res.status(200).json({ message: "success", comments: replies[0] })
        }

    } catch (error) {
        console.log(error)
        res.status(503).json({ message: "ERROR: Server error" })
    }
})

router.post("/getLike", async (req, res) => {
    if (req.body.user_id == null || req.body.post_id == null) {
        res.status(403).json({ message: "ERROR: wrong params" })
        return
    }
    try {
        const connection = await mysql.createConnection(process.env.DATABASE_URL)
        const checkLike = `SELECT * FROM POST_LIKES WHERE user_id='${req.body.user_id}' AND post_id='${req.body.post_id}'`
        const response = await connection.query(checkLike)
        if (response[0].length !== 1) {
            res.status(200).json({ message: "success", is_like: false })
            return
        }
        res.status(200).json({ message: "success", is_like: true })
    } catch (error) {
        console.log(error)
        res.status(503).json({ message: "ERROR: Server error" })
    }

})


// router.post("/changeLike", async (req, res) => {
//     if (req.body.user_id == null || req.body.post_id == null) {
//         res.status(403).json({ message: "ERROR: wrong params" })
//         return
//     }
//     try {
//         const checkParamsQuery = `SELECT id FROM Users WHERE id='${req.body.user_id}' UNION SELECT id FROM POSTS WHERE id='${req.body.post_id}'`
//         const connection = await mysql.createConnection(process.env.DATABASE_URL)
//         const response = await connection.query(checkParamsQuery)
//         if (response[0].length !== 2)    // checks post and user in db in the same query
//         {
//             res.status(403).json({ message: "ERROR: post and/or user accessed don't/doesn't exist" })
//             return
//         }
//         const changeLikeQuery = `CASE WHEN (SELECT user_id FROM POST_LIKES WHERE user_id="${req.body.user_id}" AND post_id="${req.body.post_id}") IS NULL THEN (INSERT INTO POST_LIKES VALUES('${req.body.post_id}', '${req.body.user_id}')) ELSE (DELETE FROM POST_LIKES WHERE user_id='${req.body.user_id}' AND post_id='${req.body.post_id}') END; `
//         await connection.query(changeLikeQuery)
//         res.status(200).json({ message: "success" })

//     } catch (error) {
//         console.log(error)
//         res.status(503).json({ message: "ERROR: Server error" })
//     }

// })

router.post("/addLike", async (req, res) => {
    if (req.body.user_id == null || req.body.post_id == null) {
        res.status(403).json({ message: "ERROR: wrong params" })
        return
    }
    const checkParamsQuery = `SELECT id FROM Users WHERE id='${req.body.user_id}' UNION SELECT id FROM POSTS WHERE id='${req.body.post_id}'`
    try {
        const connection = await mysql.createConnection(process.env.DATABASE_URL)
        const response = await connection.query(checkParamsQuery)
        if (response[0].length !== 2)    // checks post and user in db in the same query
        {
            res.status(403).json({ message: "ERROR: post and/or user accessed don't/doesn't exist" })
            return
        }
        const addLikeQuery = `INSERT INTO POST_LIKES VALUES('${req.body.post_id}', '${req.body.user_id}')`
        await connection.query(addLikeQuery)
        res.status(200).json({ message: "success" })

    } catch (error) {
        console.log(error)
        res.status(503).json({ message: "ERROR: Server error" })
    }

})

router.post("/removeLike", async (req, res) => {
    if (req.body.user_id == null || req.body.post_id == null) {
        res.status(403).json({ message: "ERROR: wrong params" })
        return
    }
    const checkParamsQuery = `SELECT * FROM POST_LIKES WHERE user_id='${req.body.user_id}'AND post_id='${req.body.post_id}'`
    try {
        const connection = await mysql.createConnection(process.env.DATABASE_URL)
        const response = await connection.query(checkParamsQuery)
        if (response[0].length !== 1)    // checks composite key in db in table POST_LIKES
        {
            res.status(403).json({ message: "ERROR: like wasn't found in the database" })
            return
        }
        const removeLikeQuery = `DELETE FROM POST_LIKES WHERE post_id='${req.body.post_id}' AND user_id='${req.body.user_id}'`
        await connection.query(removeLikeQuery)
        res.status(200).json({ message: "success" })

    } catch (error) {
        console.log(error)
        res.status(503).json({ message: "ERROR: Server error" })
    }

})

router.post("/getPosts", async (req, res) => {

    if (req.body.user_id == null || req.body.last_post_id === undefined) {
        res.status(403).json({ message: "ERROR: wrong params" })
        return
    }
    try {
        if (req.body.last_post_id === null) //first fetch => get most recent posts
        {
            const connection = await mysql.createConnection(process.env.DATABASE_URL)
            const query = `SELECT POSTS.id AS id, (SELECT COUNT(post_id) FROM POST_LIKES WHERE post_id=POSTS.id) AS num_likes, POSTS.user_id AS user_id, POSTS.is_public AS is_public, POSTS.photo_url AS photo_url, POSTS.date AS date, Users.username AS username, Users.photo_url AS user_photo_url, POSTS_DESCRIPTION.description AS description, (CASE WHEN (SELECT post_id FROM POST_LIKES WHERE post_id=POSTS.id AND user_id="${req.body.user_id}") IS NULL THEN 0 ELSE 1 END) AS is_liked, (SELECT COUNT(id) FROM COMMENTS WHERE parent_id=POSTS.id) AS num_comments FROM POSTS INNER JOIN Users ON POSTS.user_id = Users.id LEFT JOIN POSTS_DESCRIPTION ON POSTS.id = POSTS_DESCRIPTION.post_id WHERE POSTS.user_id IN (SELECT following FROM FOLLOW_RELATIONS WHERE follower="${req.body.user_id}") ORDER BY date DESC LIMIT 10;`
            const response = await connection.query(query)
            //TODO verificacoes caso seja necessario also fazer INNER JOIN com user ids que segue
            res.status(200).json({ message: "success", posts: response[0] })
            return
        }
        const connection = await mysql.createConnection(process.env.DATABASE_URL)
        const checkPostQuery = `SELECT id FROM POSTS WHERE id="${req.body.last_post_id}"`
        const checkPostResponse = await connection.query(checkPostQuery)
        if (checkPostResponse[0].length !== 1) {
            res.status(403).json({ message: "ERROR: last_post_id is not found in the database" })
            return
        }
        const query = `SELECT POSTS.id AS id, (SELECT COUNT(post_id) FROM POST_LIKES WHERE post_id=POSTS.id) AS num_likes, POSTS.user_id AS user_id, POSTS.is_public AS is_public, POSTS.photo_url AS photo_url, POSTS.date AS date, Users.username AS username, Users.photo_url AS user_photo_url, POSTS_DESCRIPTION.description AS description, (CASE WHEN (SELECT post_id FROM POST_LIKES WHERE post_id=POSTS.id AND user_id="${req.body.user_id}") IS NULL THEN 0 ELSE 1 END) AS is_liked, (SELECT COUNT(id) FROM COMMENTS WHERE parent_id=POSTS.id) AS num_comments FROM POSTS INNER JOIN Users ON POSTS.user_id = Users.id LEFT JOIN POSTS_DESCRIPTION ON POSTS.id = POSTS_DESCRIPTION.post_id WHERE POSTS.date <= (SELECT date FROM POSTS WHERE id="${req.body.last_post_id}") AND POSTS.id != "${req.body.last_post_id}" AND POSTS.user_id IN (SELECT following FROM FOLLOW_RELATIONS WHERE follower="${req.body.user_id}") ORDER BY date DESC LIMIT 10;`
        const response = await connection.query(query)
        res.status(200).json({ message: "success", posts: response[0] })
        //TODO acabar


    }
    catch (err) {
        console.log(err)
        res.status(503).json({ message: "ERROR: Server error" })
    }
})

router.post("/getPostsByTag", async (req, res) => {
    if (req.body.tag == null || req.body.user_id == null || req.body.last_post_id === undefined) {
        res.status(403).json({ message: "ERROR: wrong params" })
        return
    }
    try {
        const connection = await mysql.createConnection(process.env.DATABASE_URL)
        let ids_to_fetch_query;
        if (req.body.last_post_id === null) { //first fetch
            ids_to_fetch_query = `SELECT POSTS.id AS id, MAX(POSTS.date) AS date 
        FROM POSTS 
        INNER JOIN TAGS ON POSTS.id = TAGS.post_id 
        WHERE TAGS.tag REGEXP '${req.body.tag}' GROUP BY POSTS.id LIMIT 10;`
        }
        else    //subsequent fetches
        {
            const check_last_post_query = `SELECT POSTS.date FROM POSTS WHERE POSTS.id='${req.body.last_post_id}'`
            const date = (await connection.query(check_last_post_query))[0][0].date
            ids_to_fetch_query = `SELECT POSTS.id AS id, MAX(POSTS.date) AS date 
            FROM POSTS 
            INNER JOIN TAGS ON POSTS.id = TAGS.post_id 
            WHERE POSTS.date >= TIMESTAMP('${date.toJSON()}') 
            AND POSTS.id != '${req.body.last_post_id}'
            AND TAGS.tag REGEXP '${req.body.tag}' 
            GROUP BY POSTS.id 
            LIMIT 10;`
        }


        const ids = (await connection.query(ids_to_fetch_query))[0]

        if (ids.length > 0) {
            const query = `SELECT POSTS.id AS id, (SELECT COUNT(post_id) FROM POST_LIKES WHERE post_id=POSTS.id) AS num_likes, POSTS.user_id AS user_id, POSTS.is_public AS is_public, POSTS.photo_url AS photo_url, POSTS.date AS date, Users.username AS username, Users.photo_url AS user_photo_url, POSTS_DESCRIPTION.description AS description, (CASE WHEN (SELECT post_id FROM POST_LIKES WHERE post_id=POSTS.id AND user_id="${req.body.user_id}") IS NULL THEN 0 ELSE 1 END) AS is_liked, (SELECT COUNT(id) FROM COMMENTS WHERE parent_id=POSTS.id) AS num_comments FROM POSTS 
        INNER JOIN Users ON POSTS.user_id = Users.id 
        LEFT JOIN POSTS_DESCRIPTION ON POSTS.id = POSTS_DESCRIPTION.post_id 
        WHERE POSTS.id IN (${ids.map((obj) => { return `'${obj.id}'` })})
        ORDER BY date DESC`
            const response = await connection.query(query)
            res.status(200).json({ message: "success", posts: response[0] })
            return
        }
        res.status(200).json({ message: "success", posts: null })
    } catch (err) {
        console.log(err)
        res.status(503).json({ message: "ERROR: Server error", posts: null })
    }
})
module.exports = router