import Link from "next/link";
import type { ReactNode } from "react";

export function AppShell({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto min-h-screen w-full min-w-0 max-w-md overflow-x-hidden px-4 pb-10 pt-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-teal-800">家戶繳費</p>
          <h1 className="text-2xl font-semibold text-stone-900">{title}</h1>
        </div>
        {action}
      </header>
      {children}
    </div>
  );
}

export function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-full bg-teal-800 px-4 py-2 text-sm font-medium text-white"
    >
      {children}
    </Link>
  );
}

export function PrimaryButton({
  children,
  disabled,
  type = "button",
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex w-full items-center justify-center rounded-full bg-teal-800 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex w-full items-center justify-center rounded-full border border-stone-300 bg-white px-4 py-3 text-sm font-medium text-stone-800 disabled:opacity-60"
    >
      {children}
    </button>
  );
}
