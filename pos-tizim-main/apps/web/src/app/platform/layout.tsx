import Sidebar from '@/components/sidebar';

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto pt-12 pb-16 px-4 md:pt-0 md:pb-0 md:p-6">
        {children}
      </main>
    </div>
  );
}
