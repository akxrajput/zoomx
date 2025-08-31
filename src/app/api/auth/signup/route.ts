import dbConnect from "@/dbConfig/dbConnect";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import User from "@/models/User";


export async function POST(req : Request){
    try {
        const {name, email, password} = await req.json();
    
        if(!name || !email || !password){
            return NextResponse.json({message : "every field is required"}, {status : 400})
        }
        
        await dbConnect();
        
        const existing = await User.findOne({email});
       
        if(existing){
            return NextResponse.json({message : "Email is currently is in used"}, {status:409})
        }
    
        const hashedPassword = await bcrypt.hash(password, 10);
    
        User.create({name, email, password : hashedPassword})
    
        return NextResponse.json({message : "user created successfully"}, {status : 201})
    
    } catch (err) {
        console.error(err)
        return NextResponse.json({message : "error in creating the user"}, {status : 401})
    }


}

