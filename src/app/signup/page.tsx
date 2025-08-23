"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";


export default function SignupPage() {
  const [user, setUser] = useState({
    email: "",
    password: "",
    username: "",
  });

  const handleSignup= async () =>{

  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="bg-gray-900 bg-opacity-90 rounded-2xl shadow-2xl p-10 w-[400px] flex flex-col items-center border border-gray-700 hover:border-purple-500 transition duration-300">
        
        {/* Heading */}
        <h1 className="text-4xl font-extrabold text-white mb-2 tracking-wide">
          SIGN UP
        </h1>
        <p className="text-gray-400 text-sm mb-8">Create your account now</p>

        {/* Username */}
        <div className="w-full mb-6">
          <label htmlFor="username" className="block mb-2 text-gray-300 text-sm">
            Username
          </label>
          <input
            className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-600 placeholder-gray-400 transition duration-300"
            placeholder="Enter username"
            type="text"
            id="username"
            value={user.username}
            onChange={(e) => setUser({ ...user, username: e.target.value })}
          />
        </div>

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
         onClick={handleSignup}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-lg font-semibold transition duration-300 transform hover:scale-105 shadow-lg hover:shadow-purple-500/50"
        >
          Sign Up
        </button>

        {/* Link */}
        <p className="text-gray-400 text-sm mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-purple-400 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
