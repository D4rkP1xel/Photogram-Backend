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
            const createUserQuery = `INSERT INTO Users VALUES ('${req.body.user_data.email}', '${req.body.user_data.name}', '${req.body.user_data.image}');`
            await connection.query(createUserQuery)
            console.log("created user")
            res.status(200).json({ message: "success" })
            return
        }
        // else
        // {               //change later so users can change the photo in the settings menu
        //     const updateUserQuery = `UPDATE Users SET photo_url='${req.body.user_data.image}' WHERE email='${req.body.user_data.email}';`
        //     await connection.query(updateUserQuery)
        //     console.log("updated user")
        // }
        res.status(200).json({ message: "success" })

    }
    catch (err) {
        console.log(err)
        res.status(503).json({ message: "unsuccess" })
    }
})

router.post("/getUserInfo", async(req, res)=>{
    const user_email = req.body.email
    const connection = await mysql.createConnection(process.env.DATABASE_URL)
    console.log('Connected to PlanetScale!')
    const query = `SELECT * FROM Users WHERE email='${user_email}';`
    const [rows] = await connection.query(query)
    if(rows.length === 0)
    {
        res.status(404).json({message: "user not found"})
        return
    }
    res.status(200).json({message: "success", data: rows[0]})

})
module.exports = router