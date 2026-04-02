"use client";

interface UserRoleBadgeProps {
  role: string | undefined;
}

export function UserRoleBadge({ role }: UserRoleBadgeProps) {
  const isAdmin = role === "admin";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        isAdmin
          ? "bg-red-50 text-red-700 border border-red-200/60"
          : "bg-gray-100 text-gray-600 border border-gray-200/60"
      }`}
    >
      {isAdmin ? "Admin" : "User"}
    </span>
  );
}
