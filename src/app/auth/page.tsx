"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ACTIVITIES, login, signup, type Activity } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";

type Mode = "signup" | "login";

export default function AuthPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [mode, setMode] = useState<Mode>("signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState<string>("");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleActivity(a: Activity) {
    setActivities((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const parsedAge = age ? parseInt(age, 10) : null;
        await signup({
          username: username.trim(),
          password,
          age: parsedAge,
          activities,
        });
      } else {
        await login({ username: username.trim(), password });
      }
      await refresh();
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^API \d+ on [^—]+— /, "") : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-12 pb-10 animate-fade-up">
      <div className="mb-8 text-center">
        <div className="font-display text-3xl font-bold tracking-tight">Exploreus</div>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Track your hikes. Share your favorite trails.
        </p>
      </div>

      <div className="mb-6 flex rounded-full bg-zinc-200/70 p-1 dark:bg-zinc-800/70">
        {(["signup", "login"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
              mode === m
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {m === "signup" ? "Sign up" : "Log in"}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Username
          </span>
          <input
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-xl bg-surface px-4 py-3 text-base shadow-sm ring-1 ring-app focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
            minLength={3}
            maxLength={24}
            pattern="[A-Za-z0-9_]+"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl bg-surface px-4 py-3 text-base shadow-sm ring-1 ring-app focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
            minLength={6}
          />
        </label>

        {mode === "signup" && (
          <>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Age <span className="text-zinc-400">· optional</span>
              </span>
              <input
                type="number"
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="mt-1 w-full rounded-xl bg-surface px-4 py-3 text-base shadow-sm ring-1 ring-app focus:outline-none focus:ring-2 focus:ring-emerald-500"
                min={5}
                max={120}
              />
            </label>

            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Favorite activities
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {ACTIVITIES.map((a) => {
                  const on = activities.includes(a.value);
                  return (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() => toggleActivity(a.value)}
                      className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                        on
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-surface text-zinc-700 ring-1 ring-app dark:text-zinc-300"
                      }`}
                    >
                      <span>{a.emoji}</span>
                      <span>{a.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl bg-emerald-600 px-4 py-3.5 text-base font-semibold text-white shadow-sm active:scale-[0.98] disabled:opacity-60"
        >
          {submitting
            ? "Working…"
            : mode === "signup"
            ? "Create account"
            : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
        Anything you record locally before signing up is attached to your new
        account on this device automatically.
      </p>
    </div>
  );
}
