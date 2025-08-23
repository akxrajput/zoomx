import mongoose from "mongoose";

let isConnected = false;


export default async function dbConnect(){

    if(isConnected){
        console.log("DB is already connected")
        return;
    }

    if(!process.env.MONGO_URL){
        throw new Error("URL is not available please check .env")
    }


  try {
    const conn = await mongoose.connect(process.env.MONGO_URL!);
    isConnected = true;
    console.log("DB connetcted successfully !!")
    
  } catch (error) {
    throw new Error("error in connecting the database")
  }

}