import { type ReactNode } from "react";

interface PageProps {
  title: ReactNode;
  children: ReactNode;
}

export const Page = ({ title, children }: PageProps) => {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 p-4 pt-0">
      <section className="grid gap-4 border-t py-6">
        {title && <h1 className="text-2xl font-semibold">{title}</h1>}
        {children}
      </section>
    </div>
  );
};
