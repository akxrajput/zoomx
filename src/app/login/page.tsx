"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";


export default function LoginPage() {
   const router = useRouter();
  const [user, setUser] = useState({ email: "", password: "" });

  const handleLogin = async () => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          password: user.password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        console.log("✅ Login successful:", data);
        // Redirect to profile page with userId from API response
        router.push(`/profile/${data.name}`);
      } else {
        console.error("❌ Login failed:", data.message);
      }
    } catch (error) {
      console.error("⚠️ Error during login:", error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="bg-gray-900 bg-opacity-90 rounded-2xl shadow-2xl p-10 w-[400px] flex flex-col items-center border border-gray-700 hover:border-purple-500 transition duration-300">
        
        {/* Heading */}
        <h1 className="text-4xl font-extrabold text-white mb-2 tracking-wide">
          LOGIN
        </h1>
        <p className="text-gray-400 text-sm mb-8">Log in into your account</p>

        {/* Username */}
        

        {/* Email */}
        <div className="w-full mb-6">
          <label htmlFor="email" className="block mb-2 text-gray-300 text-sm">
            Email
          </label>
          <input
            className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-600 placeholder-gray-400 transition duration-300"
            placeholder="Enter email"
            type="email"
            id="email"
            value={user.email}
            onChange={(e) => setUser({ ...user, email: e.target.value })}
          />
        </div>

        {/* Password */}
        <div className="w-full mb-8">
          <label htmlFor="password" className="block mb-2 text-gray-300 text-sm">
            Password
          </label>
          <input
            className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-600 placeholder-gray-400 transition duration-300"
            placeholder="Enter password"
            type="password"
            id="password"
            value={user.password}
            onChange={(e) => setUser({ ...user, password: e.target.value })}
          />
        </div>

        {/* Button */}
        <button
         onClick={handleLogin}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-lg font-semibold transition duration-300 transform hover:scale-105 shadow-lg hover:shadow-purple-500/50"
        >
         Login
        </button>

        {/* Link */}
        <p className="text-gray-400 text-sm mt-6">
          Dont have account?{" "}
          <Link href="/signup" className="text-purple-400 hover:underline">
            Signup
          </Link>
        </p>
      </div>
    </div>
  );
}
