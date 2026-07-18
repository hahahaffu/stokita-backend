const express = require("express");
const axios = require("axios");

const router = express.Router();

router.get(
"/reverse-geocode",
async(req,res)=>{

try{

const {lat,lng}=req.query;

const response=
await axios.get(
"https://nominatim.openstreetmap.org/reverse",
{
params:{
format:"json",
lat,
lon:lng
},
headers:{
"User-Agent":"StokitaApp/1.0 (contact@stokita.com)"
}
}
);

res.json({
address:
response.data.display_name
});

}catch(err){

res.status(500).json({
message:"Gagal mengambil alamat"
});

}

}
);

module.exports = router;