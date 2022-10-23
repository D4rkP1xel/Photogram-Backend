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

router.post("/getUserInfo", async (req, res) => {
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

router.get("/getProfileInfo/:id", async (req,res)=>{
    const connection = await mysql.createConnection(process.env.DATABASE_URL)
    const query = `SELECT * FROM Users WHERE id='${req.params.id}';`
    const [rows] = await connection.query(query)
    res.json({message: "success", data: rows[0]})
})
router.post("/addprovider", async (req, res) => {
    try
    {
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
    if(providerExists === true)
    {
        res.status(403).json({ message: "provider already exists" })
        return
    }
    const addProviderQuery = `INSERT INTO Auth VALUES('${user_id}', '${req.body.provider}')`
    await connection.query(addProviderQuery)
    res.status(200).json({message: "success"})
}
catch(err)
{
    console.log(err)
    res.status(403).json({message: "error"})
}
})
module.exports = router