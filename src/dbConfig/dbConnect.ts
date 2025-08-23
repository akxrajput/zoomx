import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export default function dbConnect(){

  try {
    const conn = mongoose.connect(process.env.MONGO_URL!);
    NextResponse.json("db connected successfully!!")
    
  } catch (error) {
    throw new Error("error in connecting the database")
  }

}