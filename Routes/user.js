const router = require('express').Router()
const mysql = require('mysql2/promise')

router.post("/updateUser", async (req, res) => {
    console.log(req.body)
    try {
        const connection = await mysql.createConnection(process.env.DATABASE_URL)
        console.log('Connected to PlanetScale!')
        // const query = "CREATE TABLE Users(Id BINARY(16) PRIMARY KEY, Username VARCHAR(100), Photo_Url VARCHAR(255));"
        const query = `SELECT * FROM Users WHERE email='${req.body.user_data.email}'`
        const [rows] = await connection.query(query)
        console.log(rows)
        if (rows.length === 0) //user first time logging in -> add to db
        {
            const id = Date.now().toString() + Math.floor(Math.pow(10, 12) + Math.random() * 9 * Math.pow(10, 12)).toString(36) //lenght 22
            const createUserQuery = `INSERT INTO Users VALUES ('${id}', '${req.body.user_data.name}', '${req.body.user_data.email}', '${req.body.user_data.image}');`
            await connection.query(createUserQuery)
            const createAuthQuery = `INSERT INTO Auth VALUES('${id}', '${req.body.provider}')`
            await connection.query(createAuthQuery)
            const createDescriptionQuery = `INSERT INTO USER_DESCRIPTION VALUES('${id}', NULL)`
            await connection.query(createDescriptionQuery)
            res.status(200).json({ message: "success" })
            return
        }
        //not first time loggin in -> check if provider exists
        const selectProvidersQuery = `SELECT * FROM Auth WHERE user_id = '${rows[0].id}';`
        const providersResponse = await connection.query(selectProvidersQuery)
        console.log(providersResponse[0])
        let providerExists = false
        for (let index = 0; index < providersResponse[0].length; index++) {

            if (req.body.provider === providersResponse[0][index].provider) {
                providerExists = true
                break
            }
        }
        if (providerExists === true) {
            res.status(200).json({ message: "success" })  //regular login
            return
        }

        res.status(200).json({ message: "new provider", provider: `${req.body.provider}` }) //user gets asked if he wants to link accounts

    }
    catch (err) {
        console.log(err)
        res.status(503).json({ message: "unsuccess" })
    }
})

router.post("/getUserInfo", async (req, res) => { //search for account info
    const user_email = req.body.email
    const connection = await mysql.createConnection(process.env.DATABASE_URL)
    console.log('getting user info of ' + req.body.email)
    const query = `SELECT * FROM Users WHERE email='${user_email}';`
    const [rows] = await connection.query(query)
    if (rows.length === 0) {
        res.status(404).json({ message: "user not found" })
        return
    }
    res.status(200).json({ message: "success", data: rows[0] })

})

router.get("/getProfileInfo/:id", async (req, res) => { //search for other users info
    console.log("getting info\n")
    const connection = await mysql.createConnection(process.env.DATABASE_URL)
    const query = `SELECT Users.id as id, Users.username AS username, Users.email AS email, Users.photo_url AS photo_url, (SELECT COUNT(following) FROM FOLLOW_RELATIONS WHERE following='${req.params.id}') AS followers, (SELECT COUNT(follower) FROM FOLLOW_RELATIONS WHERE follower='${req.params.id}') AS following, USER_DESCRIPTION.description AS description FROM Users INNER JOIN USER_DESCRIPTION ON Users.id = USER_DESCRIPTION.user_id WHERE id='${req.params.id}' `
    const query_res = await connection.query(query)
    // console.log(query_res[0][0])
    res.json({ message: "success", data: query_res[0][0] })
})
router.post("/addprovider", async (req, res) => {
    try {
        if (req.body.email === null || (req.body.provider !== "google" && req.body.provider !== "facebook")) {
            res.status(405).json({ message: "wrong params" })
            return
        }
        const connection = await mysql.createConnection(process.env.DATABASE_URL)
        const query = `SELECT * FROM Users WHERE email='${req.body.email}';`
        const [rows] = await connection.query(query)
        if (rows.length === 0) {
            res.status(404).json({ message: "user not found" })
            return
        }
        const user_id = rows[0].id
        const selectProvidersQuery = `SELECT * FROM Auth WHERE user_id = '${user_id}';`
        const providersResponse = await connection.query(selectProvidersQuery)
        console.log(providersResponse[0])
        let providerExists = false
        for (let index = 0; index < providersResponse[0].length; index++) {

            if (req.body.provider === providersResponse[0][index].provider) {
                providerExists = true
                break
            }
        }
        if (providerExists === true) {
            res.status(403).json({ message: "provider already exists" })
            return
        }
        const addProviderQuery = `INSERT INTO Auth VALUES('${user_id}', '${req.body.provider}')`
        await connection.query(addProviderQuery)
        res.status(200).json({ message: "success" })
    }
    catch (err) {
        console.log(err)
        res.status(403).json({ message: "error" })
    }
})

router.post("/addFollowing", async (req, res) => {
    console.log("adding")
    if (req.body.follower == null || req.body.following == null) {
        res.status(403).json({ message: "ERROR: wrong params" })
        return
    }
    try {
        const connection = await mysql.createConnection(process.env.DATABASE_URL)
        const countQuery = `SELECT COUNT(id) AS count FROM Users WHERE id='${req.body.follower}' OR id='${req.body.following}';`
        const countResponse = await connection.query(countQuery)
        if (countResponse[0][0].count !== 2) {
            res.status(403).json({ message: "ERROR: user(s) not found" })
            return
        }
        const addFollowerQuery = `INSERT INTO FOLLOW_RELATIONS VALUES('${req.body.follower}','${req.body.following}')`
        const response = await connection.query(addFollowerQuery)
        if (response[0].affectedRows === 1) {
            res.status(200).json({ message: "success" })
            return
        }
        res.status(404).json({ message: "ERROR: unknown type 2" })
    }
    catch (err) {
        console.log(err)
        res.status(404).json({ message: "ERROR: unknown type 1" })
    }
})

router.post("/removeFollowing", async (req, res) => {
    console.log("removing")
    if (req.body.follower == null || req.body.following == null) {
        res.status(403).json({ message: "ERROR: wrong params" })
        return
    }
    try {
        const connection = await mysql.createConnection(process.env.DATABASE_URL)
        const countQuery = `SELECT COUNT(id) AS count FROM Users WHERE id='${req.body.follower}' OR id='${req.body.following}';`
        const countResponse = await connection.query(countQuery)
        if (countResponse[0][0].count !== 2) {
            res.status(403).json({ message: "ERROR: user(s) not found" })
            return
        }
        const removeFollowerQuery = `DELETE FROM FOLLOW_RELATIONS WHERE follower='${req.body.follower}' AND following='${req.body.following}'`
        const response = await connection.query(removeFollowerQuery)
        if (response[0].affectedRows === 1) {
            res.status(200).json({ message: "success" })
            return
        }
        res.status(404).json({ message: "ERROR: unknown type 2" })
    }
    catch (err) {
        console.log(err)
        res.status(404).json({ message: "ERROR: unknown type 1" })
    }
})


router.post("/getFollowing", async (req, res) => {
    if (req.body.follower == null || req.body.following == null) {
        res.status(403).json({ message: "ERROR: wrong params" })
        return
    }
    try {
        const connection = await mysql.createConnection(process.env.DATABASE_URL)
        const query = `SELECT * FROM FOLLOW_RELATIONS WHERE follower='${req.body.follower}' AND following='${req.body.following}'`
        const response = await connection.query(query)
        // console.log(response[0].length)  -> 1 if finds follow relation, 0 if not
        let follows
        if (response[0].length === 1)
            follows = true
        else
            follows = false
        res.status(200).json({ message: "success", follows })
    }
    catch (err) {
        console.log(err)
        res.status(403).json({ message: "ERROR: unknown error" })
    }
})

router.post("/editDescription", async (req, res) => {
    if (req.body.description === undefined || req.body.user_id === null) {
        res.status(403).json({ message: "ERROR: wrong params" })
        return
    }
    try {
        const connection = await mysql.createConnection(process.env.DATABASE_URL)
        const checkDescriptionQuery = `SELECT * FROM USER_DESCRIPTION WHERE user_id='${req.body.user_id}'`
        const response = await connection.query(checkDescriptionQuery)
        if (response[0].length !== 1) {
            res.status(403).json({ message: "ERROR: didn't find user in USER_DESCRIPTION table" })
            return
        }
        if (response[0][0].description === req.body.description) {
            res.status(403).json({ message: "ERROR: description sent in the request is the same as the one in db" })
            return
        }
        if(req.body.description.length > 240)
        {
            res.status(403).json({ message: "ERROR: description too large" })
            return
        }
        const editDescriptionQuery = `UPDATE USER_DESCRIPTION SET description='${req.body.description}' WHERE user_id='${req.body.user_id}'`
        await connection.query(editDescriptionQuery)
        res.status(200).json({ message: "success" })

    } catch (error) {
        console.log(error)
        res.status(403).json({ message: "ERROR: unknown error" })
    }
})

router.post("/getDescription", async(req,res)=>{
    if (req.body.user_id === null) {
        res.status(403).json({ message: "ERROR: wrong params" })
        return
    }

    try {
        const connection = await mysql.createConnection(process.env.DATABASE_URL)
        const checkDescriptionQuery = `SELECT * FROM USER_DESCRIPTION WHERE user_id='${req.body.user_id}'`
        const response = await connection.query(checkDescriptionQuery)
        if (response[0].length !== 1) {
            res.status(403).json({ message: "ERROR: didn't find user in USER_DESCRIPTION table" })
            return
        }
        res.status(200).json({ message: "success", description: response[0][0].description })
    }
    catch(err)
    {
        console.log(err)
        res.status(403).json({ message: "ERROR: unknown error" })
    }
})

router.post("/saveAccountSettings", async(req, res)=>{

    if(req.body.user_id == null || req.body.new_photo === undefined || req.body.new_name === undefined )
    {
        res.status(403).json({ message: "ERROR: wrong params" })
        return
    }

    if(req.body.new_photo !== null)
    {
        const uploadedResponse = await cloudinary.v2.uploader.upload(req.body.new_photo, {upload_preset: "user_profile_pics"})
        console.log(uploadedResponse)
    }
})
module.exports = router