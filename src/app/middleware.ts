import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
export function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value;

  const protectedRoutes = ["/profile", "/meeting"];

  if (protectedRoutes.some((route) => req.nextUrl.pathname.startsWith(route))) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("jwt secret is missing");
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET!);

      return NextResponse.redirect(new URL("/profile" , req.url));
    } catch (error) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/profile/:path*", "/meeting/:path*"],
};
