import dbConnect from "@/dbConfig/dbConnect";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import User from "@/models/User";
import jwt from "jsonwebtoken";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: "all fields required" },
        { status: 501 }
      );
    }

    await dbConnect();

    const existingUser = await User.findOne({ email });

    if (!existingUser) {
      return NextResponse.json(
        { message: "Invalid Credentials" },
        { status: 401 }
      );
    }

    const okPassword = await bcrypt.compare(password, existingUser.password);

    if (!okPassword) {
      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = jwt.sign({ email }, process.env.JWT_SECRET!, {
      expiresIn: "1d",
    });

     const response = NextResponse.json(
  { message: "Logged in", userId: existingUser._id, name: existingUser.name, },
  { status: 200 }
);
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24,
    });



    console.log("login successfull")
    return response;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "error in login" }, { status: 500 });
  }
}
