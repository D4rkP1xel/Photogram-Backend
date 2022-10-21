const router = require('express').Router()
const cloudinary = require('cloudinary')

cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

router.post("/upload", async (req, res)=>{
  try
  {
    const base64Image = req.body.image
    const uploadedResponse = await cloudinary.v2.uploader.upload(base64Image,{upload_preset: "preset_user_photo"})
    console.log(uploadedResponse)
    res.send("success")
  }
  catch(err)
  {
    console.log(err)
  }
    
})
module.exports = router