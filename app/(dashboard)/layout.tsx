import { NavBar } from "@/components/nav-bar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <NavBar />
      {/* Pad content: pb-16 on mobile clears the tab bar, md:pl-52 clears the sidebar */}
      <div className="pb-20 md:pl-52">{children}</div>
    </>
  );
}
