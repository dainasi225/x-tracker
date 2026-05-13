"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "ダッシュボード", icon: "📊" },
  { href: "/targets", label: "ターゲット", icon: "👥" },
  { href: "/quote-opportunities", label: "引用チャンス", icon: "🧭" },
  { href: "/follow-audit", label: "フォロー棚卸し", icon: "🔎" },
  { href: "/follow-maintenance", label: "フォローメンテ", icon: "🤝" },
  { href: "/interactions", label: "インタラクション", icon: "💬" },
  { href: "/settings", label: "設定", icon: "⚙️" },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="w-64 min-h-screen border-r border-x-border p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 px-3 py-4 mb-4">
        <span className="text-2xl">𝕏</span>
        <span className="text-xl font-bold text-white">トラッカー</span>
      </div>

      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`flex items-center gap-3 px-3 py-3 rounded-full text-lg transition-colors ${
            pathname === link.href
              ? "font-bold text-white bg-gray-900"
              : "text-x-gray hover:text-white hover:bg-gray-900"
          }`}
        >
          <span>{link.icon}</span>
          <span>{link.label}</span>
        </Link>
      ))}
    </nav>
  );
}
