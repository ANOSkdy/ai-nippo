"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        redirect: false,
        username,
        password,
      });
      if (result?.error) {
        setError("IDまたはパスワードが正しくありません");
      } else if (result?.ok) {
        const params = new URLSearchParams(window.location.search);
        const queryString = params.toString();
        const destination = `/nfc${queryString ? `?${queryString}` : ""}`;
        router.push(destination);
      }
    } catch (err) {
      console.error("Login failed:", err);
      setError("ログイン中にエラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-sm px-4 pt-8 pb-24">
      <h2 className="mb-6 text-center text-xl font-semibold text-gray-900">スマレポ</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="username"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            ID
          </label>
          <input
            id="username"
            type="text"
            aria-label="ID"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="h-12 w-full rounded-lg border border-gray-300 px-4 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            パスワード
          </label>
          <input
            id="password"
            type="password"
            aria-label="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-12 w-full rounded-lg border border-gray-300 px-4 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          />
        </div>
        {error && (
          <p className="text-sm text-accent-2">{error}</p>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="h-12 w-full rounded-lg bg-primary font-semibold text-white hover:bg-primary/90 disabled:bg-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          {isLoading ? "ログイン中..." : "ログイン"}
        </button>
      </form>
    </main>
  );
}

