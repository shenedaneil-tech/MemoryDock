"use client";

import { usePathname } from "next/navigation";
import { ChangeEvent, CSSProperties, FormEvent, MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, isCloudSyncConfigured } from "../lib/supabase";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

type Category = "Expense" | "Sleep" | "Movement" | "Mood" | "Meal" | "Social" | "Idea" | "Habit" | "Metric" | "Reminder" | "Note";
type SpendCategory = "Groceries" | "Dining" | "Transportation" | "Shopping" | "Bills" | "Health" | "Entertainment" | "Giving" | "Other";
type Macros = { calories: number; protein: number; carbs: number; fat: number; source: "estimated" | "manual"; items?: string[] };
type ExpenseInfo = { amount: number; merchant: string; spendCategory: SpendCategory };
type Entry = { id: string; text: string; category: Category; value?: string; time: string; timestamp: number; macros?: Macros; expense?: ExpenseInfo };
type Overlay = "search" | "notes" | "visuals" | "settings" | "profile" | "meals" | "spending" | "edit" | null;
type PageView = "today" | "timeline" | "notes" | "visuals" | "meals" | "spending" | "profile" | "settings";
type MacroForm = { calories: string; protein: string; carbs: string; fat: string };
type ExpenseForm = { amount: string; merchant: string; spendCategory: SpendCategory };
type FoodDefinition = { name: string; aliases: string[]; servingGrams?: number; unit?: "cup" | "item"; calories: number; protein: number; carbs: number; fat: number };
type FocusArea = "Nutrition" | "Spending" | "Wellness" | "Habits" | "Memories";
type Profile = { name: string; avatarDataUrl?: string; avatarColor: string; focusAreas: FocusArea[]; createdAt: number };
type ProfileDraft = Omit<Profile, "createdAt">;
type VisualSection = "overview" | "mood" | "movement" | "nutrition" | "spending" | "sleep";
type AuthMode = "sign-in" | "create";
type SyncState = "local" | "loading" | "saved" | "error";
type NotificationState = "unsupported" | "off" | "blocked" | "enabling" | "on";
type Reminder = { id: string; text: string; remindAt: number; status: "pending" | "sent" | "cancelled"; createdAt: number };

type EntryRow = {
  id: string;
  text: string;
  category: Category;
  value: string | null;
  event_time: string;
  macros: Macros | null;
  expense: ExpenseInfo | null;
};

type ProfileRow = {
  display_name: string;
  avatar_data_url: string | null;
  avatar_color: string;
  focus_areas: FocusArea[];
  macro_goals: { calories: number; protein: number; carbs: number; fat: number };
  spend_budget: number;
  theme: "day" | "night";
  created_at: string;
};

type ReminderRow = {
  id: string;
  text: string;
  remind_at: string;
  status: "pending" | "sent" | "cancelled";
  created_at: string;
};

const starterEntries: Entry[] = [
  { id: "sample-mood", text: "Feeling calm and focused this morning", category: "Mood", value: "Calm", time: "8:42 AM", timestamp: 4 },
  { id: "sample-walk", text: "Took a 30 minute morning walk", category: "Movement", value: "30 min", time: "7:35 AM", timestamp: 3 },
  { id: "sample-coffee", text: "Spent $7.50 on an iced latte and bagel", category: "Expense", value: "$7.50", time: "7:08 AM", timestamp: 2, expense: { amount: 7.5, merchant: "Unspecified", spendCategory: "Dining" }, macros: { calories: 417, protein: 17, carbs: 68, fat: 8, source: "estimated", items: ["Latte", "Bagel"] } },
  { id: "sample-sleep", text: "Slept 6 hours 42 minutes, woke up rested", category: "Sleep", value: "6h 42m", time: "6:51 AM", timestamp: 1 },
];

const categoryMeta: Record<Category, { icon: string; color: string }> = {
  Expense: { icon: "$", color: "ochre" }, Sleep: { icon: "moon", color: "violet" },
  Movement: { icon: "move", color: "green" }, Mood: { icon: "smile", color: "coral" },
  Meal: { icon: "fork", color: "blue" }, Social: { icon: "people", color: "blue" },
  Idea: { icon: "bulb", color: "ochre" }, Habit: { icon: "repeat", color: "green" },
  Metric: { icon: "metric", color: "violet" }, Note: { icon: "note", color: "slate" },
  Reminder: { icon: "bell", color: "coral" },
};

const foodDatabase: FoodDefinition[] = [
  { name: "Egg", aliases: ["eggs", "egg"], servingGrams: 50, unit: "item", calories: 72, protein: 6, carbs: .4, fat: 5 },
  { name: "Chicken breast", aliases: ["chicken breast", "grilled chicken", "chicken"], servingGrams: 113, calories: 187, protein: 35, carbs: 0, fat: 4 },
  { name: "Rice", aliases: ["brown rice", "white rice", "rice"], servingGrams: 186, unit: "cup", calories: 205, protein: 4, carbs: 45, fat: .4 },
  { name: "Broccoli", aliases: ["broccoli"], servingGrams: 156, unit: "cup", calories: 55, protein: 4, carbs: 11, fat: .6 },
  { name: "Salmon", aliases: ["salmon"], servingGrams: 113, calories: 233, protein: 25, carbs: 0, fat: 14 },
  { name: "Shrimp", aliases: ["shrimp", "prawns"], servingGrams: 113, calories: 120, protein: 23, carbs: 1, fat: 2 },
  { name: "Oatmeal", aliases: ["oatmeal", "oats"], servingGrams: 234, unit: "cup", calories: 160, protein: 6, carbs: 28, fat: 3 },
  { name: "Greek yogurt", aliases: ["greek yogurt", "yogurt"], servingGrams: 170, unit: "item", calories: 140, protein: 15, carbs: 17, fat: 0 },
  { name: "Banana", aliases: ["bananas", "banana"], servingGrams: 118, unit: "item", calories: 105, protein: 1, carbs: 27, fat: .4 },
  { name: "Apple", aliases: ["apples", "apple"], servingGrams: 182, unit: "item", calories: 95, protein: .5, carbs: 25, fat: .3 },
  { name: "Toast", aliases: ["toast", "bread"], servingGrams: 28, unit: "item", calories: 80, protein: 3, carbs: 15, fat: 1 },
  { name: "Bagel", aliases: ["bagels", "bagel"], servingGrams: 105, unit: "item", calories: 277, protein: 10, carbs: 55, fat: 1 },
  { name: "Latte", aliases: ["iced latte", "latte"], servingGrams: 355, unit: "item", calories: 140, protein: 7, carbs: 13, fat: 6 },
  { name: "Avocado", aliases: ["avocado"], servingGrams: 75, unit: "item", calories: 120, protein: 2, carbs: 6, fat: 11 },
  { name: "Sweet potato", aliases: ["sweet potato", "yam"], servingGrams: 130, unit: "item", calories: 112, protein: 2, carbs: 26, fat: .1 },
  { name: "Beans", aliases: ["black beans", "kidney beans", "beans"], servingGrams: 172, unit: "cup", calories: 225, protein: 15, carbs: 40, fat: 1 },
  { name: "Steak", aliases: ["steak"], servingGrams: 113, calories: 250, protein: 26, carbs: 0, fat: 17 },
  { name: "Ground beef", aliases: ["ground beef", "beef"], servingGrams: 113, calories: 290, protein: 26, carbs: 0, fat: 20 },
  { name: "Pork", aliases: ["pork chop", "pork"], servingGrams: 113, calories: 210, protein: 27, carbs: 0, fat: 11 },
  { name: "Pasta", aliases: ["spaghetti", "pasta"], servingGrams: 140, unit: "cup", calories: 220, protein: 8, carbs: 43, fat: 1 },
  { name: "Cheese", aliases: ["cheese"], servingGrams: 28, calories: 110, protein: 7, carbs: 1, fat: 9 },
  { name: "Protein shake", aliases: ["protein shake", "protein smoothie"], servingGrams: 350, unit: "item", calories: 180, protein: 30, carbs: 8, fat: 3 },
  { name: "Chicken wing", aliases: ["chicken wings", "wings", "wing"], servingGrams: 35, unit: "item", calories: 90, protein: 6, carbs: 1, fat: 6 },
  { name: "Oxtail", aliases: ["oxtail"], servingGrams: 170, unit: "cup", calories: 350, protein: 28, carbs: 6, fat: 24 },
  { name: "Stew peas", aliases: ["stew peas"], servingGrams: 300, unit: "cup", calories: 430, protein: 22, carbs: 48, fat: 18 },
  { name: "Curry goat", aliases: ["curry goat", "goat curry"], servingGrams: 220, unit: "cup", calories: 320, protein: 28, carbs: 8, fat: 19 },
  { name: "Plantain", aliases: ["plantains", "plantain"], servingGrams: 180, unit: "item", calories: 220, protein: 2, carbs: 57, fat: .5 },
  { name: "Pizza slice", aliases: ["pizza"], servingGrams: 107, unit: "item", calories: 285, protein: 12, carbs: 36, fat: 10 },
  { name: "Burger", aliases: ["hamburger", "burger"], servingGrams: 210, unit: "item", calories: 500, protein: 25, carbs: 40, fat: 28 },
  { name: "Fries", aliases: ["french fries", "fries"], servingGrams: 117, unit: "item", calories: 365, protein: 4, carbs: 48, fat: 17 },
];

const spendCategories: SpendCategory[] = ["Groceries", "Dining", "Transportation", "Shopping", "Bills", "Health", "Entertainment", "Giving", "Other"];
const focusAreas: FocusArea[] = ["Nutrition", "Spending", "Wellness", "Habits", "Memories"];
const avatarColors = ["#315e47", "#c76d3a", "#9f792b", "#557589", "#735f88", "#a34f58"];
const visualSections: Array<{ id: VisualSection; label: string; icon: string }> = [
  { id: "overview", label: "Overview", icon: "chart" },
  { id: "mood", label: "Mood", icon: "smile" },
  { id: "movement", label: "Movement", icon: "move" },
  { id: "nutrition", label: "Macros", icon: "fork" },
  { id: "spending", label: "Spending", icon: "wallet" },
  { id: "sleep", label: "Sleep", icon: "moon" },
];

const moodPalette: Record<string, { color: string; score: number; emoji: string }> = {
  Happy: { color: "#e9a43c", score: 5, emoji: "😊" },
  Great: { color: "#e97a38", score: 5, emoji: "😄" },
  Calm: { color: "#4f8464", score: 4, emoji: "😌" },
  Focused: { color: "#557e91", score: 4, emoji: "🙂" },
  Tired: { color: "#8a7b9d", score: 2, emoji: "😴" },
  Groggy: { color: "#827b70", score: 2, emoji: "🥱" },
  Stressed: { color: "#c46d45", score: 2, emoji: "😣" },
  Anxious: { color: "#a25f73", score: 1, emoji: "😟" },
  Sad: { color: "#5f7293", score: 1, emoji: "😔" },
  Other: { color: "#829087", score: 3, emoji: "•" },
};

function Glyph({ name, size = 20 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "home": return <svg {...common}><path d="m3 11 9-8 9 8"/><path d="M5.5 9.5V21h13V9.5M9.5 21v-7h5v7"/></svg>;
    case "timeline": return <svg {...common}><path d="M4 6h16M4 12h12M4 18h8"/><circle cx="20" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="18" r="1" fill="currentColor" stroke="none"/></svg>;
    case "chart": return <svg {...common}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>;
    case "settings": return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.18.37.49.71.89.9.28.13.59.2.91.2H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z"/></svg>;
    case "mic": return <svg {...common}><rect x="8" y="3" width="8" height="12" rx="4"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg>;
    case "plus": return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case "spark": return <svg {...common}><path d="m12 3 1.45 4.55L18 9l-4.55 1.45L12 15l-1.45-4.55L6 9l4.55-1.45L12 3ZM19 16l.65 2.35L22 19l-2.35.65L19 22l-.65-2.35L16 19l2.35-.65L19 16Z"/></svg>;
    case "search": return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
    case "sun": return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></svg>;
    case "chevron": return <svg {...common}><path d="m9 18 6-6-6-6"/></svg>;
    case "moon": return <svg {...common}><path d="M20.5 14.1A8.5 8.5 0 0 1 9.9 3.5 8.5 8.5 0 1 0 20.5 14.1Z"/></svg>;
    case "move": return <svg {...common}><path d="m13 5 2-2 2 2M15 3v6M5 13l-2 2 2 2M3 15h6M11 15h10M17 11l4 4-4 4"/></svg>;
    case "smile": return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>;
    case "fork": return <svg {...common}><path d="M6 3v7M3.5 3v5.5A1.5 1.5 0 0 0 5 10h2a1.5 1.5 0 0 0 1.5-1.5V3M6 10v11M15 3v18M15 3c4 2 4 7 0 9"/></svg>;
    case "note": return <svg {...common}><path d="M6 3h9l3 3v15H6zM14 3v4h4M9 12h6M9 16h5"/></svg>;
    case "people": return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a5 5 0 0 1 10 0v2M16 4.5a3 3 0 0 1 0 5.8M15 14a5 5 0 0 1 6 4v2"/></svg>;
    case "bulb": return <svg {...common}><path d="M9 18h6M10 22h4M8.5 15.5A7 7 0 1 1 15.5 15.5c-.8.65-1.2 1.3-1.2 2h-4.6c0-.7-.4-1.35-1.2-2Z"/></svg>;
    case "repeat": return <svg {...common}><path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/></svg>;
    case "metric": return <svg {...common}><path d="M4 20V7M10 20V11M16 20V4M22 20H2"/><path d="m4 10 6-4 6 2 5-5"/></svg>;
    case "wallet": return <svg {...common}><path d="M4 6.5h15a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h13v3.5"/><path d="M16 12h5v5h-5a2.5 2.5 0 0 1 0-5Z"/></svg>;
    case "user": return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
    case "pencil": return <svg {...common}><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20ZM14 7l3 3"/></svg>;
    case "trash": return <svg {...common}><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></svg>;
    case "bell": return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>;
    default: return null;
  }
}

function DockMark({ compact = false }: { compact?: boolean }) {
  return <svg className={`dock-mark ${compact ? "compact" : ""}`} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <rect x="2" y="4" width="44" height="34" rx="9" fill="#315e47" />
    <path d="M10 28V14l6 8 6-8v14" stroke="#fffaf0" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M27 14h4c5.2 0 9 2.5 9 7s-3.8 7-9 7h-4V14Z" stroke="#fffaf0" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="40" cy="10" r="1.8" fill="#f2ad45" />
    <path d="M8 33.5h32" stroke="#e97832" strokeWidth="2.5" strokeLinecap="round" />
    <rect x="10" y="38" width="4" height="5" rx="1" fill="#d9a22e" />
    <rect x="18" y="38" width="4" height="5" rx="1" fill="#ed7d2c" />
    <rect x="26" y="38" width="4" height="5" rx="1" fill="#d9a22e" />
    <rect x="34" y="38" width="4" height="5" rx="1" fill="#ed7d2c" />
  </svg>;
}

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "M";
}

function ProfileAvatar({ name, avatarDataUrl, avatarColor, large = false }: { name: string; avatarDataUrl?: string; avatarColor: string; large?: boolean }) {
  return <span className={`profile-avatar ${large ? "large" : ""}`} style={{ backgroundColor: avatarColor, backgroundImage: avatarDataUrl ? `url(${avatarDataUrl})` : undefined }} aria-hidden="true">
    {!avatarDataUrl && initials(name)}
  </span>;
}

function normalizeMood(entry: Entry) {
  const raw = `${entry.value || ""} ${entry.text}`.toLowerCase();
  const found = ["happy", "great", "calm", "focused", "tired", "groggy", "stressed", "anxious", "sad"].find((mood) => raw.includes(mood));
  return found ? `${found[0].toUpperCase()}${found.slice(1)}` : "Other";
}

function durationInMinutes(entry: Entry) {
  const text = `${entry.value || ""} ${entry.text}`;
  const hours = Number(text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr|h)\b/i)?.[1] || 0);
  const minutes = Number(text.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min|m)\b/i)?.[1] || 0);
  return Math.round((hours * 60) + minutes);
}

function sleepInHours(entry: Entry) {
  const text = `${entry.value || ""} ${entry.text}`;
  const hours = Number(text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr|h)\b/i)?.[1] || 0);
  const minutes = Number(text.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min|m)\b/i)?.[1] || 0);
  return Math.round((hours + minutes / 60) * 10) / 10;
}

function pageFromPath(pathname: string): PageView {
  const segment = pathname.split("/").filter(Boolean).find((part) => part === "timeline" || part === "notes" || part === "visuals" || part === "meals" || part === "spending" || part === "profile" || part === "settings");
  if (segment === "timeline" || segment === "notes" || segment === "visuals" || segment === "meals" || segment === "spending" || segment === "profile" || segment === "settings") return segment;
  return "today";
}

function roundMacro(value: number) { return Math.round(value * 10) / 10; }

function estimateMacros(text: string): Macros | undefined {
  const explicit = {
    calories: text.match(/(\d+(?:\.\d+)?)\s*(?:kcal|calories|cal)\b/i),
    protein: text.match(/(?:protein\s*:?\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*g?\s*(?:of\s+)?protein)\b/i),
    carbs: text.match(/(?:carbs?\s*:?\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*g?\s*(?:of\s+)?carbs?)\b/i),
    fat: text.match(/(?:fat\s*:?\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*g?\s*(?:of\s+)?fat)\b/i),
  };
  if (explicit.calories || explicit.protein || explicit.carbs || explicit.fat) {
    const numberFrom = (match: RegExpMatchArray | null) => Number(match?.[1] ?? match?.[2] ?? 0);
    return { calories: numberFrom(explicit.calories), protein: numberFrom(explicit.protein), carbs: numberFrom(explicit.carbs), fat: numberFrom(explicit.fat), source: "manual", items: ["Provided nutrition"] };
  }

  const lower = text.toLowerCase();
  const candidates = foodDatabase.flatMap((food) => food.aliases.map((alias) => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`\\b${escaped}\\b`, "i").exec(text);
    return match ? { food, alias, start: match.index, end: match.index + match[0].length } : null;
  })).filter((item): item is { food: FoodDefinition; alias: string; start: number; end: number } => Boolean(item)).sort((a, b) => (b.end - b.start) - (a.end - a.start));

  const usedFoods = new Set<string>();
  const usedRanges: Array<[number, number]> = [];
  const total = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const items: string[] = [];

  for (const candidate of candidates) {
    if (usedFoods.has(candidate.food.name) || usedRanges.some(([start, end]) => candidate.start < end && candidate.end > start)) continue;
    const before = lower.slice(Math.max(0, candidate.start - 30), candidate.start);
    const quantityMatch = before.match(/(\d+(?:\.\d+)?)\s*(g|grams?|oz|ounces?|cups?|slices?|pieces?|servings?|large|medium|small|x)?\s*(?:of\s+)?$/i);
    let multiplier = /\bhalf(?:\s+(?:an?|of))?\s*$/.test(before) ? .5 : 1;
    if (quantityMatch) {
      const amount = Number(quantityMatch[1]);
      const unit = (quantityMatch[2] || "").toLowerCase();
      if (/^g|gram/.test(unit) && candidate.food.servingGrams) multiplier = amount / candidate.food.servingGrams;
      else if (/^oz|ounce/.test(unit) && candidate.food.servingGrams) multiplier = (amount * 28.35) / candidate.food.servingGrams;
      else multiplier = amount;
    }
    multiplier = Math.max(.1, Math.min(multiplier, 12));
    total.calories += candidate.food.calories * multiplier;
    total.protein += candidate.food.protein * multiplier;
    total.carbs += candidate.food.carbs * multiplier;
    total.fat += candidate.food.fat * multiplier;
    items.push(`${multiplier === 1 ? "" : `${roundMacro(multiplier)}× `}${candidate.food.name}`);
    usedFoods.add(candidate.food.name); usedRanges.push([candidate.start, candidate.end]);
  }

  const soundsLikeMeal = /\bate\b|\bhad\b|breakfast|lunch|dinner|meal|snack|food|drank|coffee/.test(lower);
  if (!items.length && !soundsLikeMeal) return undefined;
  return { calories: roundMacro(total.calories), protein: roundMacro(total.protein), carbs: roundMacro(total.carbs), fat: roundMacro(total.fat), source: "estimated", items };
}

function extractExpense(text: string): ExpenseInfo | undefined {
  const amountMatch = text.match(/\$\s?([\d,]+(?:\.\d{1,2})?)/) || text.match(/(?:spent|paid|cost(?:s|ing)?|was)\s+\$?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!amountMatch) return undefined;
  const amount = Number(amountMatch[1].replace(/,/g, ""));
  if (!Number.isFinite(amount)) return undefined;
  const lower = text.toLowerCase();
  let spendCategory: SpendCategory = "Other";
  if (/shoprite|aldi|costco|grocery|groceries|supermarket|food market|whole foods/.test(lower)) spendCategory = "Groceries";
  else if (/restaurant|lunch|dinner|breakfast|coffee|latte|takeout|doordash|uber eats|chipotle|starbucks|cafe/.test(lower)) spendCategory = "Dining";
  else if (/gas|uber|lyft|train|toll|parking|bus|transit/.test(lower)) spendCategory = "Transportation";
  else if (/amazon|target|walmart|clothes|shoes|shopping|mall/.test(lower)) spendCategory = "Shopping";
  else if (/rent|bill|phone|internet|electric|insurance|subscription|utility/.test(lower)) spendCategory = "Bills";
  else if (/pharmacy|doctor|copay|medicine|dental|health/.test(lower)) spendCategory = "Health";
  else if (/movie|concert|game|tickets|entertainment/.test(lower)) spendCategory = "Entertainment";
  else if (/church|offering|donation|charity|gift/.test(lower)) spendCategory = "Giving";
  const merchantMatch = text.match(/\b(?:at|from)\s+([\w&'.-]+(?:\s+[\w&'.-]+){0,3}?)(?=\s+(?:on|for)\s+|[,.;]|$)/i);
  return { amount, merchant: merchantMatch?.[1]?.trim() || "Unspecified", spendCategory };
}

function enrichEntry(entry: Entry, position = 0): Entry {
  const expense = entry.expense ?? extractExpense(entry.text);
  const macros = entry.macros ?? estimateMacros(entry.text) ?? (expense?.spendCategory === "Dining" ? { calories: 0, protein: 0, carbs: 0, fat: 0, source: "estimated" as const, items: [] } : undefined);
  return { ...entry, timestamp: entry.timestamp < 1_000_000_000_000 ? Date.now() - (position * 60_000) : entry.timestamp, value: entry.value ?? (expense ? `$${expense.amount.toFixed(2)}` : undefined), expense, macros };
}

function hasReminderIntent(text: string) {
  return /\b(remind me|set (?:a )?reminder|reminder (?:for|to)|don['’]t let me forget|notify me)\b/i.test(text);
}

function parseReminder(text: string, now = new Date()): { remindAt: number; label: string } | null {
  if (!hasReminderIntent(text)) return null;
  const lower = text.toLowerCase();
  const relative = lower.match(/\bin\s+(\d+)\s*(minutes?|mins?|hours?|hrs?|days?)\b/);
  let target: Date;

  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    const milliseconds = unit.startsWith("day") ? amount * 86_400_000 : unit.startsWith("hour") || unit.startsWith("hr") ? amount * 3_600_000 : amount * 60_000;
    target = new Date(now.getTime() + milliseconds);
  } else {
    target = new Date(now);
    const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const weekday = weekdayNames.findIndex((day) => new RegExp(`\\b${day.slice(0, 3)}(?:${day.slice(3)})?\\b`).test(lower));
    if (/\btomorrow\b/.test(lower)) target.setDate(target.getDate() + 1);
    else if (weekday >= 0) {
      let daysAhead = (weekday - target.getDay() + 7) % 7;
      if (daysAhead === 0) daysAhead = 7;
      target.setDate(target.getDate() + daysAhead);
    } else {
      const dateMatch = lower.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
      if (dateMatch) {
        const year = dateMatch[3] ? Number(dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]) : target.getFullYear();
        target = new Date(year, Number(dateMatch[1]) - 1, Number(dateMatch[2]), target.getHours(), target.getMinutes());
      } else if (!/\btoday\b/.test(lower)) return null;
    }

    const clock = lower.match(/(?:\bat\s+|@\s*)(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\b/);
    if (!clock) return null;
    let hour = Number(clock[1]);
    const minute = Number(clock[2] || 0);
    const meridiem = clock[3]?.replace(/\./g, "");
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    if (!meridiem && hour < 8) hour += 12;
    target.setHours(hour, minute, 0, 0);
    if (/\btoday\b/.test(lower) && target.getTime() <= now.getTime()) return null;
  }

  if (target.getTime() <= now.getTime()) return null;
  return {
    remindAt: target.getTime(),
    label: new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(target),
  };
}

function classifyEntry(text: string): Pick<Entry, "category" | "value" | "macros" | "expense"> {
  const lower = text.toLowerCase();
  const reminder = parseReminder(text);
  const expense = extractExpense(text);
  const macros = estimateMacros(text) ?? (expense?.spendCategory === "Dining" ? { calories: 0, protein: 0, carbs: 0, fat: 0, source: "estimated" as const, items: [] } : undefined);
  const duration = text.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|km|k|miles?)/i);
  if (reminder) return { category: "Reminder", value: reminder.label };
  if (expense) return { category: "Expense", value: `$${expense.amount.toFixed(2)}`, expense, macros };
  if (/sleep|slept|nap|woke|bed/.test(lower)) return { category: "Sleep", value: duration ? duration[0] : undefined };
  if (/walk|ran|run|workout|gym|yoga|exercise|steps|mile|5k/.test(lower)) return { category: "Movement", value: duration ? duration[0] : undefined };
  if (/feel|feeling|mood|happy|sad|calm|anxious|great|tired|groggy|stressed/.test(lower)) {
    const mood = ["happy", "calm", "great", "focused", "tired", "groggy", "stressed", "anxious", "sad"].find((word) => lower.includes(word));
    return { category: "Mood", value: mood ? mood[0].toUpperCase() + mood.slice(1) : undefined };
  }
  if (/idea|what if|could build|maybe we should|business concept/.test(lower)) return { category: "Idea" };
  if (/prayer|meditat|vitamin|habit|streak|journaled|drank water/.test(lower)) return { category: "Habit", value: "Done" };
  if (/weight|weighed|blood pressure|heart rate|glucose|temperature/.test(lower)) return { category: "Metric", value: text.match(/\d+(?:\.\d+)?/)?.[0] };
  if (/\bwith\s+[A-Z]/.test(text) || /met with|talked (to|with)|called|visited|hung out/.test(lower)) return { category: "Social" };
  if (macros) return { category: "Meal", macros };
  return { category: "Note" };
}

function formatTime(date: Date) { return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }

function entryToRow(entry: Entry, userId: string) {
  return {
    id: entry.id,
    user_id: userId,
    text: entry.text,
    category: entry.category,
    value: entry.value || null,
    event_time: new Date(entry.timestamp).toISOString(),
    macros: entry.macros || null,
    expense: entry.expense || null,
    updated_at: new Date().toISOString(),
  };
}

function rowToEntry(row: EntryRow): Entry {
  const date = new Date(row.event_time);
  return {
    id: row.id,
    text: row.text,
    category: row.category,
    value: row.value || undefined,
    time: formatTime(date),
    timestamp: date.getTime(),
    macros: row.macros || undefined,
    expense: row.expense || undefined,
  };
}

function rowToReminder(row: ReminderRow): Reminder {
  return { id: row.id, text: row.text, remindAt: new Date(row.remind_at).getTime(), status: row.status, createdAt: new Date(row.created_at).getTime() };
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function AuthScreen({ mode, email, password, message, busy, onMode, onEmail, onPassword, onSubmit }: {
  mode: AuthMode;
  email: string;
  password: string;
  message: string;
  busy: boolean;
  onMode: (mode: AuthMode) => void;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return <main className="auth-shell">
    <section className="auth-card">
      <div className="auth-brand"><DockMark /><span><strong>MemoryDock</strong><small>Your life, safely docked.</small></span></div>
      <div className="auth-copy">
        <small>{mode === "create" ? "Create your private dock" : "Welcome back"}</small>
        <h1>{mode === "create" ? "One account for every memory." : "Sign in to your MemoryDock."}</h1>
        <p>Your meals, macros, spending, moods, movement, and notes will be securely synced across your devices.</p>
      </div>
      <form className="auth-form" onSubmit={onSubmit}>
        <label><span>Email address</span><input type="email" autoComplete="email" required value={email} onChange={(event) => onEmail(event.target.value)} placeholder="you@example.com" /></label>
        <label><span>Password</span><input type="password" autoComplete={mode === "create" ? "new-password" : "current-password"} minLength={6} required value={password} onChange={(event) => onPassword(event.target.value)} placeholder="At least 6 characters" /></label>
        {message && <p className="auth-message" role="status">{message}</p>}
        <button type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "create" ? "Create account" : "Sign in"}</button>
      </form>
      <button className="auth-switch" type="button" onClick={() => onMode(mode === "create" ? "sign-in" : "create")}>
        {mode === "create" ? "Already have an account? Sign in" : "New to MemoryDock? Create an account"}
      </button>
      <p className="auth-privacy">Each account can only access its own MemoryDock data.</p>
    </section>
  </main>;
}

export default function Home() {
  const pathname = usePathname();
  const [activePage, setActivePage] = useState<PageView>(() => pageFromPath(pathname));
  const [entries, setEntries] = useState<Entry[]>(starterEntries);
  const [localReady, setLocalReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isCloudSyncConfigured);
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>(isCloudSyncConfigured ? "loading" : "local");
  const [, setCloudHydrated] = useState(!isCloudSyncConfigured);
  const [draft, setDraft] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [notificationState, setNotificationState] = useState<NotificationState>("off");
  const [dateLabel, setDateLabel] = useState("Today");
  const [greeting, setGreeting] = useState("Hello");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [query, setQuery] = useState("");
  const [notesQuery, setNotesQuery] = useState("");
  const [notesCategory, setNotesCategory] = useState<Category | "All">("All");
  const [displayName, setDisplayName] = useState("Shay");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({ name: "Shay", avatarColor: avatarColors[0], focusAreas: [] });
  const [profileError, setProfileError] = useState("");
  const [theme, setTheme] = useState<"day" | "night">("day");
  const [visualSection, setVisualSection] = useState<VisualSection>("overview");
  const [visualMonthOffset, setVisualMonthOffset] = useState(0);
  const [macroGoals, setMacroGoals] = useState({ calories: 2000, protein: 100, carbs: 250, fat: 65 });
  const [spendBudget, setSpendBudget] = useState(0);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [macroForm, setMacroForm] = useState<MacroForm>({ calories: "", protein: "", carbs: "", fat: "" });
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>({ amount: "", merchant: "", spendCategory: "Other" });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sessionUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const syncPageFromAddress = () => setActivePage(pageFromPath(window.location.pathname));
    syncPageFromAddress();
    window.addEventListener("popstate", syncPageFromAddress);
    return () => window.removeEventListener("popstate", syncPageFromAddress);
  }, []);

  useEffect(() => {
    const capabilityTimer = window.setTimeout(() => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported || !vapidPublicKey) { setNotificationState("unsupported"); return; }
      setNotificationState(Notification.permission === "granted" ? "on" : Notification.permission === "denied" ? "blocked" : "off");
    }, 0);
    return () => window.clearTimeout(capabilityTimer);
  }, []);

  useEffect(() => {
    const hydrateTimer = window.setTimeout(() => {
      const stored = window.localStorage.getItem("log-anything-entries");
      let loaded = starterEntries;
      if (stored) { try { loaded = JSON.parse(stored); } catch { /* keep starter entries */ } }
      const enriched = loaded.map((entry, index) => enrichEntry(entry, index));
      setEntries(enriched); window.localStorage.setItem("log-anything-entries", JSON.stringify(enriched));
      const legacyName = window.localStorage.getItem("log-anything-name") || "Shay";
      setDisplayName(legacyName);
      const storedProfile = window.localStorage.getItem("memorydock-profile-v1");
      if (storedProfile) {
        try {
          const parsed = JSON.parse(storedProfile) as Profile;
          if (parsed.name) {
            const nextProfile = { ...parsed, avatarColor: parsed.avatarColor || avatarColors[0], focusAreas: parsed.focusAreas || [] };
            setProfile(nextProfile); setProfileDraft({ name: nextProfile.name, avatarDataUrl: nextProfile.avatarDataUrl, avatarColor: nextProfile.avatarColor, focusAreas: nextProfile.focusAreas }); setDisplayName(nextProfile.name);
          }
        } catch { /* keep the legacy greeting */ }
      } else {
        setProfileDraft({ name: legacyName, avatarColor: avatarColors[0], focusAreas: [] });
      }
      setTheme(window.localStorage.getItem("log-anything-theme") === "night" ? "night" : "day");
      const storedGoals = window.localStorage.getItem("log-anything-macro-goals");
      if (storedGoals) { try { setMacroGoals(JSON.parse(storedGoals)); } catch { /* keep starter goals */ } }
      setSpendBudget(Math.max(0, Number(window.localStorage.getItem("log-anything-spend-budget")) || 0));
      setDateLabel(new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date()));
      const hour = new Date().getHours(); setGreeting(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
      setLocalReady(true);
    }, 0);
    return () => window.clearTimeout(hydrateTimer);
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let active = true;
    const authFallback = window.setTimeout(() => {
      if (!active) return;
      setAuthReady(true);
      setSyncState("error");
    }, 5000);

    const applySession = (nextSession: Session | null) => {
      if (!active) return;
      window.clearTimeout(authFallback);
      const previousUserId = sessionUserIdRef.current;
      const nextUserId = nextSession?.user.id || null;
      sessionUserIdRef.current = nextUserId;
      setSession(nextSession);
      setAuthReady(true);

      // Supabase refreshes tokens when an installed iOS app resumes. A refresh
      // for the same person must not put the whole app back into its cold-start
      // loading screen; cloud hydration only reruns when the user actually changes.
      if (previousUserId !== nextUserId) {
        setSyncState(nextSession ? "loading" : "local");
        setCloudHydrated(!nextSession);
      } else if (!nextSession) {
        setSyncState("local");
        setCloudHydrated(true);
      }
    };

    void supabase.auth.getSession().then(({ data }) => {
      applySession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });
    return () => { active = false; window.clearTimeout(authFallback); listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !session || !localReady) return;
    let active = true;
    const userId = session.user.id;
    const hydrationFallback = window.setTimeout(() => {
      if (!active) return;
      setSyncState("error");
      setCloudHydrated(true);
    }, 12000);

    async function hydrateCloud() {
      try {
        setSyncState("loading");
        const [{ data: remoteEntries, error: entriesError }, { data: remoteProfile, error: profileLoadError }, { data: remoteReminders, error: remindersError }] = await Promise.all([
          supabase!.from("entries").select("id,text,category,value,event_time,macros,expense").order("event_time", { ascending: false }),
          supabase!.from("profiles").select("display_name,avatar_data_url,avatar_color,focus_areas,macro_goals,spend_budget,theme,created_at").maybeSingle(),
          supabase!.from("reminders").select("id,text,remind_at,status,created_at").order("remind_at", { ascending: true }),
        ]);
        if (!active) return;
        if (entriesError || profileLoadError || remindersError) {
          setSyncState("error");
          return;
        }

        let nextEntries = (remoteEntries as EntryRow[] | null)?.map(rowToEntry) || [];
        if (!nextEntries.length) {
          const stored = window.localStorage.getItem("log-anything-entries");
          let localEntries: Entry[] = [];
          if (stored) { try { localEntries = (JSON.parse(stored) as Entry[]).filter((entry) => !entry.id.startsWith("sample-")); } catch { /* skip invalid local data */ } }
          if (localEntries.length) {
            const { error } = await supabase!.from("entries").upsert(localEntries.map((entry) => entryToRow(enrichEntry(entry), userId)));
            if (!error) nextEntries = localEntries.map((entry) => enrichEntry(entry));
          }
        }
        setEntries(nextEntries);
        window.localStorage.setItem("log-anything-entries", JSON.stringify(nextEntries));
        setReminders(((remoteReminders as ReminderRow[] | null) || []).map(rowToReminder));

        if (remoteProfile) {
        const row = remoteProfile as ProfileRow;
        const nextProfile: Profile = {
          name: row.display_name || session!.user.email?.split("@")[0] || "You",
          avatarDataUrl: row.avatar_data_url || undefined,
          avatarColor: row.avatar_color || avatarColors[0],
          focusAreas: row.focus_areas || [],
          createdAt: new Date(row.created_at).getTime(),
        };
        setProfile(nextProfile);
        setProfileDraft({ name: nextProfile.name, avatarDataUrl: nextProfile.avatarDataUrl, avatarColor: nextProfile.avatarColor, focusAreas: nextProfile.focusAreas });
        setDisplayName(nextProfile.name);
        setMacroGoals(row.macro_goals || { calories: 2000, protein: 100, carbs: 250, fat: 65 });
        setSpendBudget(Number(row.spend_budget) || 0);
        setTheme(row.theme === "night" ? "night" : "day");
        } else {
        const storedProfile = window.localStorage.getItem("memorydock-profile-v1");
        let localProfile: Profile | null = null;
        if (storedProfile) { try { localProfile = JSON.parse(storedProfile) as Profile; } catch { /* use email fallback */ } }
        const fallbackName = localProfile?.name || session!.user.email?.split("@")[0] || "You";
        const nextProfile: Profile = localProfile || { name: fallbackName, avatarColor: avatarColors[0], focusAreas: [], createdAt: Date.now() };
        const { error } = await supabase!.from("profiles").upsert({
          user_id: userId,
          display_name: nextProfile.name,
          avatar_data_url: nextProfile.avatarDataUrl || null,
          avatar_color: nextProfile.avatarColor,
          focus_areas: nextProfile.focusAreas,
          macro_goals: macroGoals,
          spend_budget: spendBudget,
          theme,
          updated_at: new Date().toISOString(),
        });
        if (!error) {
          setProfile(nextProfile);
          setProfileDraft({ name: nextProfile.name, avatarDataUrl: nextProfile.avatarDataUrl, avatarColor: nextProfile.avatarColor, focusAreas: nextProfile.focusAreas });
          setDisplayName(nextProfile.name);
        }
        }
        setSyncState("saved");
      } catch {
        if (active) setSyncState("error");
      } finally {
        window.clearTimeout(hydrationFallback);
        if (active) setCloudHydrated(true);
      }
    }

    void hydrateCloud();
    return () => { active = false; window.clearTimeout(hydrationFallback); };
    // Cloud hydration runs once per authenticated person after local hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localReady, session?.user.id]);

  useEffect(() => {
    if (!overlay) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOverlay(null); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [overlay]);

  const stats = useMemo(() => {
    const now = new Date();
    const isToday = (entry: Entry) => { const date = new Date(entry.timestamp); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate(); };
    const isThisMonth = (entry: Entry) => { const date = new Date(entry.timestamp); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth(); };
    const todayEntries = entries.filter(isToday);
    const expenses = entries.filter((entry) => entry.expense && isThisMonth(entry));
    const expense = todayEntries.reduce((sum, entry) => sum + (entry.expense?.amount || 0), 0);
    const monthExpense = expenses.reduce((sum, entry) => sum + (entry.expense?.amount || 0), 0);
    const categories = (Object.keys(categoryMeta) as Category[]).map((category) => ({ category, count: entries.filter((entry) => entry.category === category).length }));
    const latestMood = entries.find((entry) => entry.category === "Mood")?.value || "No mood yet";
    const meals = todayEntries.filter((entry) => entry.macros);
    const macros = meals.reduce((total, entry) => ({ calories: total.calories + (entry.macros?.calories || 0), protein: total.protein + (entry.macros?.protein || 0), carbs: total.carbs + (entry.macros?.carbs || 0), fat: total.fat + (entry.macros?.fat || 0) }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    const spendByCategory = spendCategories.map((category) => ({ category, amount: expenses.reduce((sum, entry) => sum + (entry.expense?.spendCategory === category ? (entry.expense?.amount || 0) : 0), 0) })).filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount);
    const merchantMap = new Map<string, number>(); expenses.forEach((entry) => { const merchant = entry.expense?.merchant || "Unspecified"; merchantMap.set(merchant, (merchantMap.get(merchant) || 0) + (entry.expense?.amount || 0)); });
    const spendByMerchant = Array.from(merchantMap, ([merchant, amount]) => ({ merchant, amount })).sort((a, b) => b.amount - a.amount);
    return { count: todayEntries.length, expense, monthExpense, expenses, categories, latestMood, meals, macros, todayEntries, spendByCategory, spendByMerchant };
  }, [entries]);

  const visualData = useMemo(() => {
    const now = new Date();
    const monthDate = new Date(now.getFullYear(), now.getMonth() + visualMonthOffset, 1);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthEntries = entries.filter((entry) => { const date = new Date(entry.timestamp); return date.getFullYear() === year && date.getMonth() === month; });
    const daily = Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const items = monthEntries.filter((entry) => new Date(entry.timestamp).getDate() === day);
      const moodEntry = [...items].filter((entry) => entry.category === "Mood").sort((a, b) => b.timestamp - a.timestamp)[0];
      const movementEntries = items.filter((entry) => entry.category === "Movement");
      const sleepEntries = items.filter((entry) => entry.category === "Sleep");
      return {
        day,
        entries: items,
        count: items.length,
        mood: moodEntry ? normalizeMood(moodEntry) : null,
        movementMinutes: movementEntries.reduce((sum, entry) => sum + durationInMinutes(entry), 0),
        movementSessions: movementEntries.length,
        sleepHours: sleepEntries.length ? sleepEntries.reduce((sum, entry) => sum + sleepInHours(entry), 0) / sleepEntries.length : 0,
        calories: items.reduce((sum, entry) => sum + (entry.macros?.calories || 0), 0),
        protein: items.reduce((sum, entry) => sum + (entry.macros?.protein || 0), 0),
        carbs: items.reduce((sum, entry) => sum + (entry.macros?.carbs || 0), 0),
        fat: items.reduce((sum, entry) => sum + (entry.macros?.fat || 0), 0),
        spending: items.reduce((sum, entry) => sum + (entry.expense?.amount || 0), 0),
      };
    });
    const categories = (Object.keys(categoryMeta) as Category[]).map((category) => ({ category, count: monthEntries.filter((entry) => entry.category === category).length })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count);
    const moodEntries = monthEntries.filter((entry) => entry.category === "Mood");
    const moodCounts = Object.entries(moodEntries.reduce<Record<string, number>>((counts, entry) => { const mood = normalizeMood(entry); counts[mood] = (counts[mood] || 0) + 1; return counts; }, {})).map(([mood, count]) => ({ mood, count, ...moodPalette[mood] })).sort((a, b) => b.count - a.count);
    const movementEntries = monthEntries.filter((entry) => entry.category === "Movement");
    const movementMinutes = movementEntries.reduce((sum, entry) => sum + durationInMinutes(entry), 0);
    const sleepEntries = monthEntries.filter((entry) => entry.category === "Sleep").map((entry) => ({ entry, hours: sleepInHours(entry) })).filter((item) => item.hours > 0);
    const mealEntries = monthEntries.filter((entry) => entry.macros);
    const macroTotals = mealEntries.reduce((total, entry) => ({ calories: total.calories + (entry.macros?.calories || 0), protein: total.protein + (entry.macros?.protein || 0), carbs: total.carbs + (entry.macros?.carbs || 0), fat: total.fat + (entry.macros?.fat || 0) }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    const nutritionDays = daily.filter((day) => day.calories > 0).length;
    const expenses = monthEntries.filter((entry) => entry.expense);
    const spendTotal = expenses.reduce((sum, entry) => sum + (entry.expense?.amount || 0), 0);
    const spendByCategory = spendCategories.map((category) => ({ category, amount: expenses.reduce((sum, entry) => sum + (entry.expense?.spendCategory === category ? (entry.expense?.amount || 0) : 0), 0) })).filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount);
    return {
      monthDate,
      monthLabel: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(monthDate),
      firstDayOffset: new Date(year, month, 1).getDay(),
      daily,
      monthEntries,
      categories,
      activeDays: daily.filter((day) => day.count > 0).length,
      maxDailyLogs: Math.max(1, ...daily.map((day) => day.count)),
      moodEntries,
      moodCounts,
      positiveMoods: moodEntries.filter((entry) => (moodPalette[normalizeMood(entry)]?.score || 3) >= 4).length,
      movementEntries,
      movementMinutes,
      maxMovementMinutes: Math.max(1, ...daily.map((day) => day.movementMinutes)),
      sleepEntries,
      averageSleep: sleepEntries.length ? sleepEntries.reduce((sum, item) => sum + item.hours, 0) / sleepEntries.length : 0,
      maxSleep: Math.max(8, ...daily.map((day) => day.sleepHours)),
      mealEntries,
      macroTotals,
      nutritionDays,
      maxCalories: Math.max(1, ...daily.map((day) => day.calories)),
      expenses,
      spendTotal,
      spendByCategory,
      maxDailySpend: Math.max(1, ...daily.map((day) => day.spending)),
    };
  }, [entries, visualMonthOffset]);

  const searchResults = useMemo(() => entries.filter((entry) => `${entry.text} ${entry.category} ${entry.value || ""} ${entry.expense?.merchant || ""} ${entry.expense?.spendCategory || ""} ${entry.macros?.items?.join(" ") || ""}`.toLowerCase().includes(query.toLowerCase())), [entries, query]);
  const notesCategories = useMemo(() => (Object.keys(categoryMeta) as Category[]).map((category) => ({ category, count: entries.filter((entry) => entry.category === category).length })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count), [entries]);
  const notesResults = useMemo(() => {
    const needle = notesQuery.trim().toLowerCase();
    return entries.filter((entry) => (notesCategory === "All" || entry.category === notesCategory) && (!needle || `${entry.text} ${entry.category} ${entry.value || ""} ${entry.expense?.merchant || ""} ${entry.expense?.spendCategory || ""} ${entry.macros?.items?.join(" ") || ""}`.toLowerCase().includes(needle)));
  }, [entries, notesCategory, notesQuery]);
  const groupedNotes = useMemo(() => notesCategories.map(({ category }) => ({ category, entries: notesResults.filter((entry) => entry.category === category) })).filter((group) => group.entries.length > 0), [notesCategories, notesResults]);
  const upcomingReminders = useMemo(() => reminders.filter((reminder) => reminder.status === "pending" && reminder.remindAt > Date.now()).sort((a, b) => a.remindAt - b.remindAt), [reminders]);
  const editingEntry = entries.find((entry) => entry.id === editingEntryId);
  const overlayCopy: Record<Exclude<Overlay, null>, { eyebrow: string; title: string }> = {
    search: { eyebrow: "Find a moment", title: "Search your logs" }, notes: { eyebrow: "Everything, neatly docked", title: "Notes & categories" }, visuals: { eyebrow: "See the bigger picture", title: "Your month, visualized" },
    settings: { eyebrow: "Make it yours", title: "Settings" }, profile: { eyebrow: profile ? "Your MemoryDock" : "Welcome to MemoryDock", title: profile ? "Edit your profile" : "Create your profile" }, meals: { eyebrow: "Today’s nutrition", title: "Meals & macros" },
    spending: { eyebrow: "This month", title: "Spending tracker" }, edit: { eyebrow: "Correct the details", title: "Edit log details" },
  };
  const routePanel: Exclude<Overlay, null> | null = activePage === "today" ? null : activePage === "timeline" ? "search" : activePage;
  const panel = overlay || routePanel;
  const isPagePanel = overlay === null && routePanel !== null;
  const panelCopy = activePage === "timeline" && panel === "search" && isPagePanel ? { eyebrow: "Everything you’ve saved", title: "Your timeline" } : panel ? overlayCopy[panel] : null;

  function saveText(text: string) {
    const clean = text.trim();
    if (!clean) { textareaRef.current?.focus(); return; }
    const now = new Date();
    const reminder = parseReminder(clean, now);
    if (hasReminderIntent(clean) && !reminder) {
      setSavedMessage("Add a future day and time, like “Wednesday at 3 PM.”");
      window.setTimeout(() => setSavedMessage(""), 3200);
      return;
    }
    const next: Entry = { id: `${now.getTime()}`, text: clean, ...classifyEntry(clean), time: formatTime(now), timestamp: now.getTime() };
    const updated = [next, ...entries];
    persistEntries(updated);
    if (reminder) {
      const nextReminder: Reminder = { id: next.id, text: clean, remindAt: reminder.remindAt, status: "pending", createdAt: now.getTime() };
      setReminders((current) => [...current.filter((item) => item.id !== next.id), nextReminder]);
      void persistReminder(nextReminder);
      setSavedMessage(`Reminder set for ${reminder.label}`);
    } else setSavedMessage("Saved and sorted");
    setDraft(""); window.setTimeout(() => setSavedMessage(""), 3000);
  }

  function addEntry(event?: FormEvent) { event?.preventDefault(); saveText(draft); }

  function persistEntries(updated: Entry[]) {
    setEntries(updated); window.localStorage.setItem("log-anything-entries", JSON.stringify(updated));
    const supabase = getSupabase();
    if (supabase && session) {
      setSyncState("loading");
      void supabase.from("entries").upsert(updated.map((entry) => entryToRow(entry, session.user.id))).then(({ error }) => setSyncState(error ? "error" : "saved"));
    }
  }

  function removeEntry(id: string) {
    const updated = entries.filter((entry) => entry.id !== id);
    persistEntries(updated);
    const supabase = getSupabase();
    if (supabase && session) {
      setSyncState("loading");
      void supabase.from("entries").delete().eq("id", id).then(({ error }) => setSyncState(error ? "error" : "saved"));
      if (reminders.some((reminder) => reminder.id === id)) void supabase.from("reminders").delete().eq("id", id);
    }
    setReminders((current) => current.filter((reminder) => reminder.id !== id));
  }

  async function persistReminder(reminder: Reminder) {
    const supabase = getSupabase();
    if (!supabase || !session) return;
    const { error } = await supabase.from("reminders").upsert({ id: reminder.id, user_id: session.user.id, text: reminder.text, remind_at: new Date(reminder.remindAt).toISOString(), status: reminder.status, updated_at: new Date().toISOString() });
    setSyncState(error ? "error" : "saved");
  }

  async function cancelReminder(id: string) {
    setReminders((current) => current.map((reminder) => reminder.id === id ? { ...reminder, status: "cancelled" } : reminder));
    const supabase = getSupabase();
    if (supabase && session) await supabase.from("reminders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id);
  }

  async function enableNotifications() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window) || !vapidPublicKey) { setNotificationState("unsupported"); return; }
    setNotificationState("enabling");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") { setNotificationState(permission === "denied" ? "blocked" : "off"); return; }
    try {
      const rootUrl = new URL(pageHref("today"), window.location.href);
      const registration = await navigator.serviceWorker.register(new URL("sw.js", rootUrl).pathname, { scope: rootUrl.pathname });
      await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) });
      const json = subscription.toJSON();
      const supabase = getSupabase();
      if (!supabase || !session || !json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("Subscription could not be saved");
      const { error } = await supabase.from("push_subscriptions").upsert({ user_id: session.user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent, updated_at: new Date().toISOString() }, { onConflict: "endpoint" });
      if (error) throw error;
      setNotificationState("on");
      await registration.showNotification("MemoryDock notifications are on", { body: "Your reminders can now reach this device.", icon: new URL("icon-192.png", rootUrl).pathname, badge: new URL("icon-192.png", rootUrl).pathname, tag: "memorydock-enabled" });
    } catch {
      setNotificationState("off");
      setSavedMessage("Notifications could not be enabled. Try again from the installed Home Screen app.");
      window.setTimeout(() => setSavedMessage(""), 4200);
    }
  }

  function openEntryEditor(entry: Entry) {
    const macros = entry.macros || { calories: 0, protein: 0, carbs: 0, fat: 0 };
    setEditingEntryId(entry.id);
    setMacroForm({ calories: String(macros.calories || ""), protein: String(macros.protein || ""), carbs: String(macros.carbs || ""), fat: String(macros.fat || "") });
    setExpenseForm({ amount: entry.expense ? String(entry.expense.amount) : "", merchant: entry.expense?.merchant === "Unspecified" ? "" : entry.expense?.merchant || "", spendCategory: entry.expense?.spendCategory || "Other" });
    setOverlay("edit");
  }

  function saveEntryEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingEntryId) return;
    const toNumber = (value: string) => Math.max(0, Number(value) || 0);
    const updated = entries.map((entry) => {
      if (entry.id !== editingEntryId) return entry;
      const hasMacroValues = Boolean(entry.macros || macroForm.calories || macroForm.protein || macroForm.carbs || macroForm.fat);
      const amount = toNumber(expenseForm.amount);
      const nextExpense = entry.expense || amount > 0 ? { amount, merchant: expenseForm.merchant.trim() || "Unspecified", spendCategory: expenseForm.spendCategory } : undefined;
      const nextMacros = hasMacroValues ? { calories: toNumber(macroForm.calories), protein: toNumber(macroForm.protein), carbs: toNumber(macroForm.carbs), fat: toNumber(macroForm.fat), source: "manual" as const, items: entry.macros?.items } : undefined;
      return { ...entry, expense: nextExpense, macros: nextMacros, value: nextExpense ? `$${nextExpense.amount.toFixed(2)}` : entry.value };
    });
    persistEntries(updated); setOverlay(null); setEditingEntryId(null);
  }

  function saveMacroGoals(next: typeof macroGoals) {
    setMacroGoals(next); window.localStorage.setItem("log-anything-macro-goals", JSON.stringify(next));
    void saveCloudProfileFields({ macro_goals: next });
  }

  function startVoice() {
    type Rec = { continuous: boolean; interimResults: boolean; lang: string; start: () => void; onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void; onend: () => void; onerror: () => void };
    const SpeechRecognition = (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition;
    if (!SpeechRecognition) { setDraft("Voice input isn’t available in this browser. You can type here instead."); textareaRef.current?.focus(); return; }
    const recognition = new SpeechRecognition(); recognition.continuous = false; recognition.interimResults = false; recognition.lang = "en-US";
    recognition.onresult = (event) => { saveText(event.results[0][0].transcript); setIsListening(false); };
    recognition.onend = () => setIsListening(false); recognition.onerror = () => setIsListening(false);
    setIsListening(true); recognition.start();
  }

  function toggleTheme() {
    const next = theme === "day" ? "night" : "day";
    setTheme(next); window.localStorage.setItem("log-anything-theme", next);
    void saveCloudProfileFields({ theme: next });
  }

  function exportLogs() {
    const file = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a"); link.href = url; link.download = "memorydock-journal.json"; link.click();
    URL.revokeObjectURL(url);
  }

  function saveSpendBudget(value: number) {
    const next = Math.max(0, value || 0); setSpendBudget(next); window.localStorage.setItem("log-anything-spend-budget", String(next));
    void saveCloudProfileFields({ spend_budget: next });
  }

  async function saveCloudProfileFields(fields: Record<string, unknown>) {
    const supabase = getSupabase();
    if (!supabase || !session) return;
    setSyncState("loading");
    const { error } = await supabase.from("profiles").upsert({ user_id: session.user.id, ...fields, updated_at: new Date().toISOString() });
    setSyncState(error ? "error" : "saved");
  }

  function exportSpending() {
    const escapeCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const rows = [["Date", "Time", "Amount", "Merchant", "Category", "Original log"], ...stats.expenses.map((entry) => [new Date(entry.timestamp).toLocaleDateString(), entry.time, entry.expense?.amount || 0, entry.expense?.merchant || "Unspecified", entry.expense?.spendCategory || "Other", entry.text])];
    const csv = rows.map((row) => row.map(escapeCell).join(",")).join("\n");
    const file = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(file);
    const link = document.createElement("a"); link.href = url; link.download = "memorydock-spending.csv"; link.click(); URL.revokeObjectURL(url);
  }

  function handleProfilePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setProfileError("Choose an image file for your profile photo."); return; }
    if (file.size > 6 * 1024 * 1024) { setProfileError("Choose a photo smaller than 6 MB."); return; }
    const reader = new FileReader();
    reader.onerror = () => setProfileError("That photo could not be opened. Try another one.");
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => setProfileError("That photo could not be opened. Try another one.");
      image.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas"); canvas.width = size; canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context) { setProfileError("That photo could not be prepared. Try another one."); return; }
        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale; const height = image.height * scale;
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        setProfileDraft((current) => ({ ...current, avatarDataUrl: canvas.toDataURL("image/jpeg", .82) })); setProfileError("");
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function saveProfile(event: FormEvent) {
    event.preventDefault();
    const name = profileDraft.name.trim();
    if (!name) { setProfileError("Add your name so MemoryDock can personalize your space."); return; }
    const next: Profile = { ...profileDraft, name, createdAt: profile?.createdAt || Date.now() };
    setProfile(next); setDisplayName(name); window.localStorage.setItem("memorydock-profile-v1", JSON.stringify(next)); window.localStorage.setItem("log-anything-name", name); setProfileError(""); setOverlay(null);
    void saveCloudProfileFields({ display_name: name, avatar_data_url: next.avatarDataUrl || null, avatar_color: next.avatarColor, focus_areas: next.focusAreas });
  }

  function deleteProfile() {
    if (!window.confirm("Delete your profile? Your logs, meals, and spending will stay saved.")) return;
    window.localStorage.removeItem("memorydock-profile-v1"); window.localStorage.removeItem("log-anything-name");
    setProfile(null); setDisplayName("Shay"); setProfileDraft({ name: "Shay", avatarColor: avatarColors[0], focusAreas: [] }); setOverlay(null);
    const supabase = getSupabase();
    if (supabase && session) void supabase.from("profiles").delete().eq("user_id", session.user.id);
  }

  async function handleAuth(event: FormEvent) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;
    setAuthBusy(true); setAuthMessage("");
    const email = authEmail.trim();
    const result = authMode === "create"
      ? await supabase.auth.signUp({ email, password: authPassword, options: { emailRedirectTo: window.location.href } })
      : await supabase.auth.signInWithPassword({ email, password: authPassword });
    setAuthBusy(false);
    if (result.error) { setAuthMessage(result.error.message); return; }
    setAuthPassword("");
    if (authMode === "create" && !result.data.session) setAuthMessage("Check your email to confirm your account, then come back and sign in.");
  }

  async function signOut() {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    setEntries([]); setReminders([]); setProfile(null); setDisplayName("Shay"); setCloudHydrated(true);
  }

  function clearAllLogs() {
    if (!window.confirm("Clear every saved log from your MemoryDock account?")) return;
    setEntries([]); window.localStorage.setItem("log-anything-entries", "[]"); setOverlay(null);
    const supabase = getSupabase();
    if (supabase && session) {
      setSyncState("loading");
      void supabase.from("entries").delete().eq("user_id", session.user.id).then(({ error }) => setSyncState(error ? "error" : "saved"));
    }
  }

  function openOverlay(next: Exclude<Overlay, null>) { setOverlay(next); if (next !== "search") setQuery(""); }

  function pageHref(page: PageView) {
    if (activePage === "today") return page === "today" ? "./" : `./${page}/`;
    return page === "today" ? "../" : `../${page}/`;
  }

  function navigatePage(event: ReactMouseEvent<HTMLAnchorElement>, page: PageView) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setOverlay(null);
    setActivePage(page);
    const nextUrl = new URL(pageHref(page), window.location.href);
    window.history.pushState({ memoryDockPage: page }, "", nextUrl.pathname);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  if (isCloudSyncConfigured && !authReady) {
    return <main className="auth-shell"><section className="auth-card auth-loading"><DockMark /><h1>Opening your MemoryDock…</h1><p>Loading your private account and saved data.</p></section></main>;
  }

  if (isCloudSyncConfigured && !session) {
    return <AuthScreen mode={authMode} email={authEmail} password={authPassword} message={authMessage} busy={authBusy} onMode={(mode) => { setAuthMode(mode); setAuthMessage(""); }} onEmail={setAuthEmail} onPassword={setAuthPassword} onSubmit={handleAuth} />;
  }

  return <main className={`app-shell ${theme === "night" ? "night" : ""} ${activePage !== "today" ? "page-mode" : ""}`}>
    <aside className="sidebar">
      <a className="brand" href={pageHref("today")} onClick={(event) => navigatePage(event, "today")} aria-label="MemoryDock home"><DockMark /><span>MemoryDock</span></a>
      <nav className="side-nav" aria-label="Main navigation">
        <a className={`nav-item ${activePage === "today" ? "active" : ""}`} href={pageHref("today")} onClick={(event) => navigatePage(event, "today")}><Glyph name="home" /><span>Today</span></a>
        <a className={`nav-item ${activePage === "timeline" ? "active" : ""}`} href={pageHref("timeline")} onClick={(event) => navigatePage(event, "timeline")}><Glyph name="timeline" /><span>Timeline</span></a>
        <a className={`nav-item ${activePage === "notes" ? "active" : ""}`} href={pageHref("notes")} onClick={(event) => navigatePage(event, "notes")}><Glyph name="note" /><span>Notes</span></a>
        <a className={`nav-item ${activePage === "visuals" ? "active" : ""}`} href={pageHref("visuals")} onClick={(event) => navigatePage(event, "visuals")}><Glyph name="chart" /><span>Visuals</span></a>
        <a className={`nav-item ${activePage === "meals" ? "active" : ""}`} href={pageHref("meals")} onClick={(event) => navigatePage(event, "meals")}><Glyph name="fork" /><span>Meals</span></a>
        <a className={`nav-item ${activePage === "spending" ? "active" : ""}`} href={pageHref("spending")} onClick={(event) => navigatePage(event, "spending")}><Glyph name="wallet" /><span>Spending</span></a>
      </nav>
      <div className="sidebar-foot">
        <a className={`nav-item ${activePage === "settings" ? "active" : ""}`} href={pageHref("settings")} onClick={(event) => navigatePage(event, "settings")}><Glyph name="settings" /><span>Settings</span></a>
        <a className={`profile-chip ${activePage === "profile" ? "active" : ""}`} href={pageHref("profile")} onClick={(event) => navigatePage(event, "profile")}><ProfileAvatar name={profile?.name || displayName} avatarDataUrl={profile?.avatarDataUrl} avatarColor={profile?.avatarColor || avatarColors[0]} /><span><strong>{profile?.name || "Create profile"}</strong><small>{profile?.focusAreas.length ? profile.focusAreas.slice(0, 2).join(" · ") : "Personalize your dock"}</small></span><Glyph name="chevron" size={15} /></a>
      </div>
    </aside>

    <section className="main-panel home-panel" id="top">
      <header className="topbar">
        <div><p className="eyebrow">{dateLabel}</p><h1>{greeting}, {displayName}.</h1></div>
        <div className="header-actions">{session && <span className={`sync-pill ${syncState}`}><i />{syncState === "loading" ? "Syncing" : syncState === "error" ? "Sync issue" : "Synced"}</span>}<button className="icon-button" onClick={() => openOverlay("search")} aria-label="Search"><Glyph name="search" /></button><button className="icon-button" onClick={toggleTheme} aria-label="Change appearance"><Glyph name="sun" /></button><a className="mobile-mark" href={pageHref("settings")} onClick={(event) => navigatePage(event, "settings")} aria-label="Open settings"><DockMark compact /></a></div>
      </header>

      <section className="capture-card" id="today">
        <div className="capture-heading"><span className="capture-spark"><Glyph name="spark" size={17} /></span><span>Log anything</span></div>
        <form onSubmit={addEntry}>
          <textarea ref={textareaRef} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="What happened? Say it naturally…" aria-label="What would you like to log?" rows={3} />
          <div className="capture-footer">
            <div className="capture-hint"><Glyph name="spark" size={14} /> I’ll sort and label it for you</div>
            <div className="capture-actions">
              <button className={`mic-button ${isListening ? "listening" : ""}`} type="button" onClick={startVoice} aria-label="Start voice input"><Glyph name="mic" /><span>{isListening ? "Listening…" : "Speak"}</span></button>
              <button className="save-button" type="submit"><Glyph name="plus" size={18} /><span>Save log</span></button>
            </div>
          </div>
        </form>
        {savedMessage && <div className="toast" role="status">{savedMessage}</div>}
      </section>

      <div className="prompt-row" aria-label="Example logs">{["Chicken, rice and broccoli for lunch", "Spent $46 at ShopRite on groceries", "Slept 7 hours"].map((prompt) => <button key={prompt} onClick={() => { setDraft(prompt); textareaRef.current?.focus(); }}>{prompt}</button>)}</div>

      <section className="timeline-section" id="timeline">
        <div className="section-heading"><div><p className="eyebrow">Your day, at a glance</p><h2>Today</h2></div><span className="entry-count">{stats.count} {stats.count === 1 ? "entry" : "entries"}</span></div>
        <div className="entry-list">
          {stats.todayEntries.length === 0 ? <div className="empty-state"><DockMark compact /><h3>Your day starts here</h3><p>Say or type anything above. We’ll turn it into a useful log.</p></div> : stats.todayEntries.map((entry) => {
            const meta = categoryMeta[entry.category];
            return <article className="entry-card" key={entry.id}>
              <div className={`category-icon ${meta.color}`}>{meta.icon === "$" ? <b>$</b> : <Glyph name={meta.icon} size={19} />}</div>
              <div className="entry-copy"><div className="entry-meta"><span className={`category-pill ${meta.color}`}>{entry.category}</span><time>{entry.time}</time></div><p>{entry.text}</p>{entry.expense && <span className="spend-detail">{entry.expense.merchant} · {entry.expense.spendCategory}</span>}{entry.macros && <button className="macro-strip" onClick={() => openEntryEditor(entry)}><span>{Math.round(entry.macros.calories)} cal</span><i>{Math.round(entry.macros.protein)}g P</i><i>{Math.round(entry.macros.carbs)}g C</i><i>{Math.round(entry.macros.fat)}g F</i><Glyph name="pencil" size={12} /></button>}</div>
              <div className="entry-side">{entry.value && <strong className="entry-value">{entry.value}</strong>}{(entry.macros || entry.expense) && <button className="entry-edit" onClick={() => openEntryEditor(entry)} aria-label={`Edit details for ${entry.text}`}><Glyph name="pencil" size={14} /></button>}</div>
              <button className="entry-delete" onClick={() => removeEntry(entry.id)} aria-label={`Delete ${entry.text}`}><Glyph name="trash" size={17} /></button>
            </article>;
          })}
        </div>
      </section>
    </section>

    <aside className="right-rail home-rail">
      <section className="rail-card daily-card">
        <div className="rail-title"><span><Glyph name="spark" size={17} /></span><h2>Daily snapshot</h2></div>
        <div className="snapshot-grid"><div><small>Logs</small><strong>{stats.count}</strong><span>today</span></div><div><small>Spent</small><strong>${stats.expense.toFixed(2)}</strong><span>today</span></div></div>
        <div className="mood-row"><span className="mood-face"><Glyph name="smile" /></span><span><small>Latest mood</small><strong>{stats.latestMood}</strong></span></div>
      </section>
      <section className="rail-card reminder-rail-card">
        <div className="rail-title"><span><Glyph name="bell" size={17} /></span><h2>Next reminder</h2><a href={pageHref("settings")} onClick={(event) => navigatePage(event, "settings")}>Manage</a></div>
        {upcomingReminders[0] ? <div className="next-reminder"><strong>{upcomingReminders[0].text}</strong><span>{new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(upcomingReminders[0].remindAt)}</span></div> : <p className="rail-empty">Say “Remind me…” and include a day and time.</p>}
      </section>
      <section className="rail-card macro-rail-card">
        <div className="rail-title"><span><Glyph name="fork" size={17} /></span><h2>Today’s macros</h2><a href={pageHref("meals")} onClick={(event) => navigatePage(event, "meals")}>View</a></div>
        <div className="calorie-summary"><strong>{Math.round(stats.macros.calories)}</strong><span>of {macroGoals.calories} calories</span><i><b style={{ width: `${Math.min(100, (stats.macros.calories / macroGoals.calories) * 100)}%` }} /></i></div>
        <div className="mini-macros"><span><b>{Math.round(stats.macros.protein)}g</b>Protein</span><span><b>{Math.round(stats.macros.carbs)}g</b>Carbs</span><span><b>{Math.round(stats.macros.fat)}g</b>Fat</span></div>
      </section>
      <section className="rail-card spend-rail-card">
        <div className="rail-title"><span><Glyph name="wallet" size={17} /></span><h2>Spending</h2><a href={pageHref("spending")} onClick={(event) => navigatePage(event, "spending")}>View</a></div>
        <div className="spend-rail-total"><small>This month</small><strong>${stats.monthExpense.toFixed(2)}</strong><span>{stats.expenses.length} {stats.expenses.length === 1 ? "transaction" : "transactions"}</span></div>
        {spendBudget > 0 ? <div className="budget-mini"><i><b style={{ width: `${Math.min(100, (stats.monthExpense / spendBudget) * 100)}%` }} /></i><span>${Math.max(0, spendBudget - stats.monthExpense).toFixed(2)} left of ${spendBudget.toFixed(0)}</span></div> : <a className="set-budget-link" href={pageHref("spending")} onClick={(event) => navigatePage(event, "spending")}>Set a monthly budget</a>}
        {stats.spendByMerchant[0] && <div className="top-merchant"><span>{stats.spendByMerchant[0].merchant[0]?.toUpperCase() || "$"}</span><div><small>Top place</small><strong>{stats.spendByMerchant[0].merchant}</strong></div><b>${stats.spendByMerchant[0].amount.toFixed(2)}</b></div>}
      </section>
      <a className="review-link" href={pageHref("visuals")} onClick={(event) => navigatePage(event, "visuals")}><span>View your month</span><Glyph name="chevron" size={18} /></a>
    </aside>

    <nav className="mobile-nav" aria-label="Mobile navigation">
      <a className={activePage === "today" ? "active" : ""} href={pageHref("today")} onClick={(event) => navigatePage(event, "today")}><Glyph name="home" /><span>Today</span></a><a className={activePage === "meals" ? "active" : ""} href={pageHref("meals")} onClick={(event) => navigatePage(event, "meals")}><Glyph name="fork" /><span>Meals</span></a>
      <a className={`mobile-visual ${activePage === "visuals" ? "active" : ""}`} href={pageHref("visuals")} onClick={(event) => navigatePage(event, "visuals")} aria-label="Open visual dashboard"><Glyph name="chart" size={22} /><span>Visuals</span></a>
      <a className={activePage === "spending" ? "active" : ""} href={pageHref("spending")} onClick={(event) => navigatePage(event, "spending")}><Glyph name="wallet" /><span>Spending</span></a><a className={activePage === "notes" ? "active" : ""} href={pageHref("notes")} onClick={(event) => navigatePage(event, "notes")}><Glyph name="note" /><span>Notes</span></a>
    </nav>

    {panel && <div className={isPagePanel ? "page-layer" : "overlay-layer"} role={isPagePanel ? undefined : "presentation"} onMouseDown={(event) => { if (!isPagePanel && event.target === event.currentTarget) setOverlay(null); }}>
      <section className={`${isPagePanel ? "page-panel" : "overlay-panel"} ${panel === "visuals" ? "visual-overlay" : ""}`} role={isPagePanel ? "region" : "dialog"} aria-modal={isPagePanel ? undefined : true} aria-labelledby="panel-title">
        <div className="overlay-head">
          <div><p className="eyebrow">{panelCopy?.eyebrow}</p><h2 id="panel-title">{panelCopy?.title}</h2></div>
          {!isPagePanel && <button className="close-button" onClick={() => setOverlay(null)} aria-label="Close">×</button>}
        </div>

        {panel === "search" && <div className="search-view">
          <label className="search-box"><Glyph name="search" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “coffee,” “sleep,” or “$12”…" /></label>
          <p className="result-label">{query ? `${searchResults.length} matching ${searchResults.length === 1 ? "log" : "logs"}` : "All logs"}</p>
          <div className="overlay-list">{searchResults.map((entry) => { const meta = categoryMeta[entry.category]; return <article key={entry.id}><span className={`category-icon ${meta.color}`}>{meta.icon === "$" ? <b>$</b> : <Glyph name={meta.icon} size={18} />}</span><span><small>{entry.category} · {entry.time}</small><strong>{entry.text}</strong></span>{entry.value && <em>{entry.value}</em>}</article>; })}</div>
          {searchResults.length === 0 && <div className="mini-empty"><Glyph name="search" size={28} /><p>No matching moments yet.</p></div>}
        </div>}

        {panel === "notes" && <div className="notes-view">
          <div className="notes-intro"><p>Every log is automatically sorted into a category. Search a word or tap a category to find it later.</p><strong>{entries.length}<span>saved</span></strong></div>
          <label className="search-box notes-search"><Glyph name="search" /><input value={notesQuery} onChange={(event) => setNotesQuery(event.target.value)} placeholder="Search your notes…" /></label>
          <div className="note-category-filters" aria-label="Filter notes by category">
            <button type="button" className={notesCategory === "All" ? "active" : ""} onClick={() => setNotesCategory("All")}><span className="all-category-icon"><Glyph name="note" size={15} /></span><b>All</b><em>{entries.length}</em></button>
            {notesCategories.map(({ category, count }) => { const meta = categoryMeta[category]; return <button type="button" className={notesCategory === category ? "active" : ""} key={category} onClick={() => setNotesCategory(category)}><span className={`category-icon ${meta.color}`}>{meta.icon === "$" ? <b>$</b> : <Glyph name={meta.icon} size={15} />}</span><b>{category}</b><em>{count}</em></button>; })}
          </div>
          <div className="notes-summary"><span>{notesQuery || notesCategory !== "All" ? `${notesResults.length} found` : "Browse by category"}</span>{(notesQuery || notesCategory !== "All") && <button type="button" onClick={() => { setNotesQuery(""); setNotesCategory("All"); }}>Clear filters</button>}</div>
          <div className="note-groups">
            {groupedNotes.map((group) => { const meta = categoryMeta[group.category]; return <section className="note-group" key={group.category}><div className="note-group-head"><span className={`category-icon ${meta.color}`}>{meta.icon === "$" ? <b>$</b> : <Glyph name={meta.icon} size={17} />}</span><div><h3>{group.category}</h3><p>{group.entries.length} {group.entries.length === 1 ? "note" : "notes"}</p></div></div><div className="note-list">{group.entries.map((entry) => <article key={entry.id}><div><small>{entry.time}{entry.value ? ` · ${entry.value}` : ""}</small><p>{entry.text}</p>{entry.expense && <span>{entry.expense.merchant} · {entry.expense.spendCategory}</span>}{entry.macros?.items?.length ? <span>{entry.macros.items.join(" · ")}</span> : null}</div>{(entry.macros || entry.expense) && <button type="button" onClick={() => openEntryEditor(entry)} aria-label={`Edit details for ${entry.text}`}><Glyph name="pencil" size={14} /></button>}</article>)}</div></section>; })}
          </div>
          {notesResults.length === 0 && <div className="mini-empty"><Glyph name="note" size={28} /><p>{entries.length ? "No notes match those filters." : "Your saved notes will appear here."}</p></div>}
        </div>}

        {panel === "visuals" && <div className="visuals-view">
          <div className="visual-toolbar">
            <button type="button" onClick={() => setVisualMonthOffset((offset) => offset - 1)} aria-label="Previous month">‹</button>
            <span><small>Monthly view</small><strong>{visualData.monthLabel}</strong></span>
            <button type="button" disabled={visualMonthOffset === 0} onClick={() => setVisualMonthOffset((offset) => Math.min(0, offset + 1))} aria-label="Next month">›</button>
          </div>
          <div className="visual-tabs" role="tablist" aria-label="Choose what to visualize">
            {visualSections.map((section) => <button type="button" role="tab" aria-selected={visualSection === section.id} className={visualSection === section.id ? "active" : ""} key={section.id} onClick={() => setVisualSection(section.id)}><Glyph name={section.icon} size={16} /><span>{section.label}</span></button>)}
          </div>

          {visualSection === "overview" && <div className="visual-panel">
            <div className="visual-stat-grid">
              <article className="accent-green"><small>Logs</small><strong>{visualData.monthEntries.length}</strong><span>this month</span></article>
              <article className="accent-orange"><small>Days captured</small><strong>{visualData.activeDays}</strong><span>of {visualData.daily.length}</span></article>
              <article className="accent-blue"><small>Top category</small><strong>{visualData.categories[0]?.category || "—"}</strong><span>{visualData.categories[0]?.count || 0} logs</span></article>
              <article className="accent-violet"><small>Different areas</small><strong>{visualData.categories.length}</strong><span>types of moments</span></article>
            </div>
            <section className="visual-card">
              <div className="visual-card-head"><div><small>Everything you logged</small><h3>Categories</h3></div><span>{visualData.monthEntries.length} total</span></div>
              {visualData.categories.length ? <div className="entity-bars">{visualData.categories.map(({ category, count }) => <button type="button" key={category} onClick={() => { const sectionMap: Partial<Record<Category, VisualSection>> = { Mood: "mood", Movement: "movement", Meal: "nutrition", Expense: "spending", Sleep: "sleep" }; if (sectionMap[category]) setVisualSection(sectionMap[category]!); }}><span><i className={`category-icon ${categoryMeta[category].color}`}>{categoryMeta[category].icon === "$" ? "$" : <Glyph name={categoryMeta[category].icon} size={13} />}</i>{category}</span><em><b style={{ width: `${Math.max(6, (count / (visualData.categories[0]?.count || 1)) * 100)}%` }} /></em><strong>{count}</strong></button>)}</div> : <div className="visual-empty">Log a few moments and your monthly patterns will appear here.</div>}
            </section>
            <section className="visual-card">
              <div className="visual-card-head"><div><small>Consistency</small><h3>Days you checked in</h3></div><span>Darker means more logs</span></div>
              <div className="month-calendar compact-calendar"><div className="calendar-weekdays">{["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="calendar-days">{Array.from({ length: visualData.firstDayOffset }).map((_, index) => <i className="calendar-blank" key={`blank-${index}`} />)}{visualData.daily.map((day) => <i key={day.day} title={`${day.count} logs on day ${day.day}`} className={day.count ? "has-data" : ""} style={{ "--intensity": Math.max(.2, day.count / visualData.maxDailyLogs) } as CSSProperties}><b>{day.day}</b><span>{day.count || ""}</span></i>)}</div></div>
            </section>
          </div>}

          {visualSection === "mood" && <div className="visual-panel">
            <div className="visual-stat-grid three">
              <article className="accent-coral"><small>Check-ins</small><strong>{visualData.moodEntries.length}</strong><span>moods logged</span></article>
              <article className="accent-green"><small>Most common</small><strong>{visualData.moodCounts[0]?.mood || "—"}</strong><span>{visualData.moodCounts[0]?.emoji || "Add a mood"}</span></article>
              <article className="accent-orange"><small>Positive check-ins</small><strong>{visualData.positiveMoods}</strong><span>calm, focused or happy</span></article>
            </div>
            <section className="visual-card">
              <div className="visual-card-head"><div><small>How the month felt</small><h3>Mood mix</h3></div><span>{visualData.moodEntries.length} check-ins</span></div>
              {visualData.moodCounts.length ? <div className="mood-distribution">{visualData.moodCounts.map((item) => <div key={item.mood}><span><b style={{ background: item.color }}>{item.emoji}</b>{item.mood}</span><i><b style={{ width: `${(item.count / visualData.moodEntries.length) * 100}%`, background: item.color }} /></i><strong>{item.count}</strong></div>)}</div> : <div className="visual-empty">Try “Feeling calm today” to start your mood view.</div>}
            </section>
            <section className="visual-card">
              <div className="visual-card-head"><div><small>Daily view</small><h3>Mood calendar</h3></div><span>Latest mood each day</span></div>
              <div className="month-calendar mood-calendar"><div className="calendar-weekdays">{["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="calendar-days">{Array.from({ length: visualData.firstDayOffset }).map((_, index) => <i className="calendar-blank" key={`mood-blank-${index}`} />)}{visualData.daily.map((day) => <i key={day.day} title={day.mood || `No mood on day ${day.day}`}><b>{day.day}</b>{day.mood && <span style={{ background: moodPalette[day.mood].color }}>{moodPalette[day.mood].emoji}</span>}</i>)}</div></div>
            </section>
          </div>}

          {visualSection === "movement" && <div className="visual-panel">
            <div className="visual-stat-grid three"><article className="accent-green"><small>Active time</small><strong>{visualData.movementMinutes}</strong><span>minutes logged</span></article><article className="accent-orange"><small>Sessions</small><strong>{visualData.movementEntries.length}</strong><span>movement logs</span></article><article className="accent-blue"><small>Average</small><strong>{visualData.movementEntries.length ? Math.round(visualData.movementMinutes / visualData.movementEntries.length) : 0}</strong><span>minutes per session</span></article></div>
            <section className="visual-card"><div className="visual-card-head"><div><small>Day by day</small><h3>Movement minutes</h3></div><span>{visualData.monthLabel}</span></div><div className="daily-chart-scroll"><div className="daily-bars movement-bars">{visualData.daily.map((day) => <span key={day.day} title={`${day.movementMinutes} minutes on day ${day.day}`}><i><b style={{ height: `${day.movementMinutes ? Math.max(7, (day.movementMinutes / visualData.maxMovementMinutes) * 100) : 2}%` }} /></i><small>{day.day === 1 || day.day % 5 === 0 ? day.day : ""}</small></span>)}</div></div></section>
            {!visualData.movementEntries.length && <div className="visual-tip"><Glyph name="move" size={18} /><p><strong>Start a movement trend</strong>Log something like “Walked 30 minutes” or “Ran 5k.”</p></div>}
          </div>}

          {visualSection === "nutrition" && <div className="visual-panel">
            <div className="visual-stat-grid three"><article className="accent-orange"><small>Average calories</small><strong>{visualData.nutritionDays ? Math.round(visualData.macroTotals.calories / visualData.nutritionDays) : 0}</strong><span>per logged day</span></article><article className="accent-green"><small>Protein</small><strong>{Math.round(visualData.macroTotals.protein)}g</strong><span>this month</span></article><article className="accent-blue"><small>Meals</small><strong>{visualData.mealEntries.length}</strong><span>with macro data</span></article></div>
            <section className="visual-card"><div className="visual-card-head"><div><small>Daily total</small><h3>Calories</h3></div><span>{visualData.nutritionDays} days logged</span></div><div className="daily-chart-scroll"><div className="daily-bars nutrition-bars">{visualData.daily.map((day) => <span key={day.day} title={`${Math.round(day.calories)} calories on day ${day.day}`}><i><b style={{ height: `${day.calories ? Math.max(7, (day.calories / visualData.maxCalories) * 100) : 2}%` }} /></i><small>{day.day === 1 || day.day % 5 === 0 ? day.day : ""}</small></span>)}</div></div></section>
            <section className="visual-card macro-mix-card"><div className="visual-card-head"><div><small>Monthly total</small><h3>Macro mix</h3></div><span>{Math.round(visualData.macroTotals.calories)} calories</span></div><div className="macro-mix">{(["protein", "carbs", "fat"] as const).map((macro) => { const max = Math.max(1, visualData.macroTotals.protein, visualData.macroTotals.carbs, visualData.macroTotals.fat); return <div key={macro}><span>{macro}</span><i><b style={{ width: `${(visualData.macroTotals[macro] / max) * 100}%` }} /></i><strong>{Math.round(visualData.macroTotals[macro])}g</strong></div>; })}</div></section>
          </div>}

          {visualSection === "spending" && <div className="visual-panel">
            <div className="visual-stat-grid three"><article className="accent-orange"><small>Total spent</small><strong>${visualData.spendTotal.toFixed(0)}</strong><span>{visualData.expenses.length} transactions</span></article><article className="accent-green"><small>Spending days</small><strong>{visualData.daily.filter((day) => day.spending > 0).length}</strong><span>this month</span></article><article className="accent-blue"><small>Top category</small><strong>{visualData.spendByCategory[0]?.category || "—"}</strong><span>{visualData.spendByCategory[0] ? `$${visualData.spendByCategory[0].amount.toFixed(2)}` : "No spending yet"}</span></article></div>
            <section className="visual-card"><div className="visual-card-head"><div><small>Day by day</small><h3>Daily spending</h3></div><a href={pageHref("spending")} onClick={(event) => navigatePage(event, "spending")}>Open tracker</a></div><div className="daily-chart-scroll"><div className="daily-bars spending-bars">{visualData.daily.map((day) => <span key={day.day} title={`$${day.spending.toFixed(2)} on day ${day.day}`}><i><b style={{ height: `${day.spending ? Math.max(7, (day.spending / visualData.maxDailySpend) * 100) : 2}%` }} /></i><small>{day.day === 1 || day.day % 5 === 0 ? day.day : ""}</small></span>)}</div></div></section>
            <section className="visual-card"><div className="visual-card-head"><div><small>Where it went</small><h3>Spending categories</h3></div><span>${visualData.spendTotal.toFixed(2)}</span></div>{visualData.spendByCategory.length ? <div className="macro-mix spend-mix">{visualData.spendByCategory.map((item) => <div key={item.category}><span>{item.category}</span><i><b style={{ width: `${(item.amount / (visualData.spendByCategory[0]?.amount || 1)) * 100}%` }} /></i><strong>${item.amount.toFixed(0)}</strong></div>)}</div> : <div className="visual-empty">Spending will be sorted into categories as you log it.</div>}</section>
          </div>}

          {visualSection === "sleep" && <div className="visual-panel">
            <div className="visual-stat-grid three"><article className="accent-violet"><small>Average sleep</small><strong>{visualData.averageSleep.toFixed(1)}h</strong><span>per logged night</span></article><article className="accent-blue"><small>Nights logged</small><strong>{visualData.sleepEntries.length}</strong><span>this month</span></article><article className="accent-green"><small>Longest night</small><strong>{visualData.sleepEntries.length ? Math.max(...visualData.sleepEntries.map((item) => item.hours)).toFixed(1) : "0.0"}h</strong><span>best rest logged</span></article></div>
            <section className="visual-card"><div className="visual-card-head"><div><small>Night by night</small><h3>Hours of sleep</h3></div><span>8-hour guide</span></div><div className="daily-chart-scroll"><div className="daily-bars sleep-bars">{visualData.daily.map((day) => <span key={day.day} title={`${day.sleepHours.toFixed(1)} hours on day ${day.day}`}><i><b style={{ height: `${day.sleepHours ? Math.max(7, (day.sleepHours / visualData.maxSleep) * 100) : 2}%` }} /></i><small>{day.day === 1 || day.day % 5 === 0 ? day.day : ""}</small></span>)}</div></div></section>
            {!visualData.sleepEntries.length && <div className="visual-tip"><Glyph name="moon" size={18} /><p><strong>See your sleep pattern</strong>Log “Slept 7 hours 30 minutes” when you wake up.</p></div>}
          </div>}
        </div>}

        {panel === "meals" && <div className="meals-view">
          <section className="macro-hero">
            <div className="macro-calories"><small>Calories today</small><strong>{Math.round(stats.macros.calories)}</strong><span>of {macroGoals.calories} kcal</span><i><b style={{ width: `${Math.min(100, (stats.macros.calories / macroGoals.calories) * 100)}%` }} /></i></div>
            <div className="macro-cards">
              {(["protein", "carbs", "fat"] as const).map((macro) => <article key={macro}><small>{macro}</small><strong>{Math.round(stats.macros[macro])}<em>g</em></strong><i><b style={{ width: `${Math.min(100, (stats.macros[macro] / macroGoals[macro]) * 100)}%` }} /></i><span>{Math.max(0, Math.round(macroGoals[macro] - stats.macros[macro]))}g left</span></article>)}
            </div>
          </section>
          <section className="goal-editor"><div><h3>Daily goals</h3><p>Use your own targets. You can change these anytime.</p></div><div className="goal-inputs">{(["calories", "protein", "carbs", "fat"] as const).map((goal) => <label key={goal}><span>{goal === "calories" ? "Calories" : `${goal[0].toUpperCase()}${goal.slice(1)} (g)`}</span><input type="number" min="0" value={macroGoals[goal]} onChange={(event) => saveMacroGoals({ ...macroGoals, [goal]: Math.max(0, Number(event.target.value)) })} /></label>)}</div></section>
          <div className="meal-list-head"><div><h3>Meals logged</h3><p>Tap Adjust when you know the package or recipe values.</p></div><span>{stats.meals.length}</span></div>
          <div className="meal-list">{stats.meals.map((entry) => <article className="meal-item" key={entry.id}><span className="meal-icon"><Glyph name="fork" /></span><div><small>{entry.time} · {entry.macros?.source === "manual" ? "Verified by you" : "Estimated"}</small><strong>{entry.text}</strong><p>{entry.macros?.items?.length ? entry.macros.items.join(" · ") : "Add the nutrition details for a more useful total."}</p></div><div className="meal-numbers"><strong>{Math.round(entry.macros?.calories || 0)} <small>cal</small></strong><span>{Math.round(entry.macros?.protein || 0)}P · {Math.round(entry.macros?.carbs || 0)}C · {Math.round(entry.macros?.fat || 0)}F</span><button onClick={() => openEntryEditor(entry)}>Adjust</button></div></article>)}</div>
          {stats.meals.length === 0 && <div className="mini-empty"><Glyph name="fork" size={28} /><p>Log a meal to start calculating macros.</p></div>}
          <div className="nutrition-note"><Glyph name="spark" size={17} /><p><strong>About estimates</strong>Food portions and recipes vary. These are helpful starting estimates, not medical nutrition advice. Adjust them whenever you know the exact values.</p></div>
        </div>}

        {panel === "spending" && <div className="spending-view">
          <section className="spend-hero">
            <div className="spend-total"><small>Spent this month</small><strong>${stats.monthExpense.toFixed(2)}</strong><span>{stats.expenses.length} {stats.expenses.length === 1 ? "transaction" : "transactions"} tracked</span></div>
            <div className="budget-control"><label><span>Monthly budget</span><div><b>$</b><input type="number" min="0" step="10" value={spendBudget || ""} placeholder="Set a goal" onChange={(event) => saveSpendBudget(Number(event.target.value))} /></div></label><p>{spendBudget > 0 ? `$${Math.max(0, spendBudget - stats.monthExpense).toFixed(2)} remaining` : "Add a budget to track what’s left."}</p><i><b style={{ width: `${spendBudget ? Math.min(100, (stats.monthExpense / spendBudget) * 100) : 0}%` }} /></i></div>
          </section>
          <div className="spend-columns">
            <section className="spend-breakdown"><div className="spend-section-head"><div><h3>By category</h3><p>What your money went toward</p></div></div>{stats.spendByCategory.length ? stats.spendByCategory.map((item) => <div className="spend-bar" key={item.category}><div><span>{item.category}</span><strong>${item.amount.toFixed(2)}</strong></div><i><b style={{ width: `${(item.amount / (stats.spendByCategory[0]?.amount || 1)) * 100}%` }} /></i><small>{stats.monthExpense ? Math.round((item.amount / stats.monthExpense) * 100) : 0}%</small></div>) : <p className="subtle-empty">No categorized spending yet.</p>}</section>
            <section className="merchant-breakdown"><div className="spend-section-head"><div><h3>Where you spent</h3><p>Places and merchants</p></div></div>{stats.spendByMerchant.length ? stats.spendByMerchant.map((item) => <div className="merchant-row" key={item.merchant}><span>{item.merchant[0]?.toUpperCase() || "$"}</span><strong>{item.merchant}</strong><b>${item.amount.toFixed(2)}</b></div>) : <p className="subtle-empty">Add “at [place]” to a spending log.</p>}</section>
          </div>
          <div className="transaction-head"><div><h3>Transactions</h3><p>Tap one to correct the place, amount, or category.</p></div><button onClick={exportSpending}>Export CSV</button></div>
          <div className="transaction-list">{stats.expenses.map((entry) => <button className="transaction-row" key={entry.id} onClick={() => openEntryEditor(entry)}><span className="transaction-icon"><Glyph name="wallet" size={17} /></span><span><small>{entry.time} · {entry.expense?.spendCategory}</small><strong>{entry.expense?.merchant || "Unspecified"}</strong><p>{entry.text}</p></span><b>${(entry.expense?.amount || 0).toFixed(2)}</b><Glyph name="chevron" size={15} /></button>)}</div>
          {stats.expenses.length === 0 && <div className="mini-empty"><Glyph name="wallet" size={28} /><p>Log “Spent $20 at…” to start tracking.</p></div>}
          <div className="spend-tip"><Glyph name="spark" size={17} /><p><strong>For the best breakdown</strong>Include the amount, place, and purpose: “Spent $46 at ShopRite on groceries.” You can always fix the details afterward.</p></div>
        </div>}

        {panel === "edit" && editingEntry && <form className="macro-edit-form" onSubmit={saveEntryEdit}>
          <div className="edit-entry-copy"><span className="meal-icon"><Glyph name={editingEntry.expense ? "wallet" : "fork"} /></span><div><small>{editingEntry.time}</small><strong>{editingEntry.text}</strong></div></div>
          {editingEntry.expense && <section className="detail-form-section"><div className="detail-form-heading"><h3>Spending details</h3><p>Correct anything we misunderstood.</p></div><div className="expense-form-grid"><label><span>Amount</span><div className="money-input"><b>$</b><input autoFocus type="number" min="0" step="0.01" value={expenseForm.amount} onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })} /></div></label><label><span>Where</span><input type="text" placeholder="Store or merchant" value={expenseForm.merchant} onChange={(event) => setExpenseForm({ ...expenseForm, merchant: event.target.value })} /></label><label><span>Category</span><select value={expenseForm.spendCategory} onChange={(event) => setExpenseForm({ ...expenseForm, spendCategory: event.target.value as SpendCategory })}>{spendCategories.map((category) => <option key={category}>{category}</option>)}</select></label></div></section>}
          {editingEntry.macros && <section className="detail-form-section"><div className="detail-form-heading"><h3>Meal macros</h3><p>Enter the total nutrition for the portion you ate.</p></div><div className="macro-form-grid">
            <label><span>Calories</span><input autoFocus={!editingEntry.expense} type="number" min="0" step="1" value={macroForm.calories} onChange={(event) => setMacroForm({ ...macroForm, calories: event.target.value })} /><small>kcal</small></label>
            <label><span>Protein</span><input type="number" min="0" step="0.1" value={macroForm.protein} onChange={(event) => setMacroForm({ ...macroForm, protein: event.target.value })} /><small>grams</small></label>
            <label><span>Carbs</span><input type="number" min="0" step="0.1" value={macroForm.carbs} onChange={(event) => setMacroForm({ ...macroForm, carbs: event.target.value })} /><small>grams</small></label>
            <label><span>Fat</span><input type="number" min="0" step="0.1" value={macroForm.fat} onChange={(event) => setMacroForm({ ...macroForm, fat: event.target.value })} /><small>grams</small></label>
          </div></section>}
          <div className="form-actions"><button type="button" onClick={() => setOverlay(null)}>Cancel</button><button type="submit">Save details</button></div>
        </form>}

        {panel === "profile" && <form className="profile-form" onSubmit={saveProfile}>
          <section className="profile-photo-section">
            <ProfileAvatar large name={profileDraft.name} avatarDataUrl={profileDraft.avatarDataUrl} avatarColor={profileDraft.avatarColor} />
            <div><h3>Your face or your color</h3><p>Add a photo, or keep a simple colored initial.</p><span className="photo-actions"><label>Choose photo<input type="file" accept="image/*" onChange={handleProfilePhoto} /></label>{profileDraft.avatarDataUrl && <button type="button" onClick={() => setProfileDraft({ ...profileDraft, avatarDataUrl: undefined })}>Remove</button>}</span></div>
          </section>
          <label className="profile-field"><span>Display name</span><input autoFocus type="text" maxLength={40} value={profileDraft.name} onChange={(event) => setProfileDraft({ ...profileDraft, name: event.target.value })} placeholder="What should MemoryDock call you?" /></label>
          <fieldset className="profile-fieldset"><legend>Avatar color</legend><div className="color-swatches">{avatarColors.map((color) => <button type="button" aria-label={`Use ${color} as avatar color`} aria-pressed={profileDraft.avatarColor === color} className={profileDraft.avatarColor === color ? "selected" : ""} style={{ background: color }} key={color} onClick={() => setProfileDraft({ ...profileDraft, avatarColor: color })} />)}</div></fieldset>
          <fieldset className="profile-fieldset"><legend>What do you want to notice?</legend><p>Pick any focus areas. You can change these later.</p><div className="focus-chips">{focusAreas.map((area) => { const selected = profileDraft.focusAreas.includes(area); return <button type="button" aria-pressed={selected} className={selected ? "selected" : ""} key={area} onClick={() => setProfileDraft({ ...profileDraft, focusAreas: selected ? profileDraft.focusAreas.filter((item) => item !== area) : [...profileDraft.focusAreas, area] })}>{area}</button>; })}</div></fieldset>
          {profileError && <p className="profile-error" role="alert">{profileError}</p>}
          <div className="profile-privacy"><Glyph name="spark" size={17} /><p><strong>{session ? "Private to your account" : "Private on this device"}</strong>{session ? "Your profile and logs securely sync whenever you sign in." : "Your profile and photo stay in this browser with your logs."}</p></div>
          <div className="profile-actions"><a href={pageHref(profile ? "settings" : "today")} onClick={(event) => navigatePage(event, profile ? "settings" : "today")}>{profile ? "Cancel" : "Not now"}</a><button type="submit">{profile ? "Save changes" : "Create profile"}</button></div>
          {profile && <button className="delete-profile" type="button" onClick={deleteProfile}>Delete profile</button>}
        </form>}

        {panel === "settings" && <div className="settings-view">
          <a className="setting-row profile-setting" href={pageHref("profile")} onClick={(event) => navigatePage(event, "profile")}><span><strong>{profile ? "Profile" : "Create your profile"}</strong><small>{profile ? `${profile.name} · ${profile.focusAreas.length ? profile.focusAreas.join(", ") : "Add focus areas"}` : "Add your name, photo, color, and focus areas"}</small></span><ProfileAvatar name={profile?.name || displayName} avatarDataUrl={profile?.avatarDataUrl} avatarColor={profile?.avatarColor || avatarColors[0]} /></a>
          {session && <div className="setting-row account-setting"><span><strong>Account</strong><small>{session.user.email} · Your data is synced</small></span><button type="button" onClick={signOut}>Sign out</button></div>}
          <div className="setting-row notification-setting"><span><strong>Device reminders</strong><small>{notificationState === "on" ? "Notifications are enabled on this device" : notificationState === "blocked" ? "Notifications are blocked in this device’s settings" : notificationState === "unsupported" ? "On iPhone, add MemoryDock to the Home Screen first" : "Get reminders even when MemoryDock is closed"}</small></span>{notificationState === "on" ? <em>On</em> : <button type="button" disabled={notificationState === "enabling" || notificationState === "blocked"} onClick={enableNotifications}>{notificationState === "enabling" ? "Turning on…" : notificationState === "blocked" ? "Blocked" : "Turn on"}</button>}</div>
          <section className="reminder-settings">
            <div><h3>Upcoming reminders</h3><p>Try: “Remind me about my appointment Wednesday at 3 PM.”</p></div>
            {upcomingReminders.length ? <div className="reminder-list">{upcomingReminders.map((reminder) => <article key={reminder.id}><span><Glyph name="bell" size={16} /></span><div><strong>{reminder.text}</strong><small>{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(reminder.remindAt)}</small></div><button type="button" onClick={() => cancelReminder(reminder.id)}>Cancel</button></article>)}</div> : <p className="subtle-empty">No upcoming reminders.</p>}
          </section>
          <button className="setting-row" onClick={toggleTheme}><span><strong>Appearance</strong><small>Switch between light and evening mode</small></span><em>{theme === "day" ? "Light" : "Evening"}</em></button>
          <button className="setting-row" onClick={exportLogs}><span><strong>Export your logs</strong><small>Download a private copy as a data file</small></span><Glyph name="chevron" size={18} /></button>
          <div className="install-note"><DockMark compact /><p><strong>Use it like an app</strong>On iPhone, tap Share, then “Add to Home Screen” for one-tap logging.</p></div>
          <div className="privacy-note"><Glyph name="spark" size={18} /><p><strong>Private by default</strong>{session ? "Your account data is protected so only you can read or change it." : "Typed entries stay in this browser on this device."} Voice transcription depends on your browser.</p></div>
          <button className="clear-button" onClick={clearAllLogs}>Clear all logs</button>
        </div>}
      </section>
    </div>}
  </main>;
}
