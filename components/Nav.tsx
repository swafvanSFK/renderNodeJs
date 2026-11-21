"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Live" },
  { href: "/users", label: "People" },
  { href: "/settings", label: "Device" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav>
      {links.map((link) => (
        <Link key={link.href} href={link.href} className={pathname === link.href ? "active" : ""}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
