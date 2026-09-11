import Sidebar from '@/components/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main
        className="flex-1 overflow-auto relative dashboard-bg"
        style={{
          paddingTop: 'var(--app-top-offset)',
          paddingBottom: 'var(--app-bottom-offset)',
        }}
      >
        {/* Decorative background elements */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10 md:left-56">
          <div className="absolute -top-24 -right-24 w-[500px] h-[500px] bg-gradient-to-br from-blue-200/40 to-indigo-200/30 rounded-full blur-3xl dash-blob-1" />
          <div className="absolute top-1/3 -left-16 w-80 h-80 bg-gradient-to-br from-violet-200/25 to-purple-200/20 rounded-full blur-3xl dash-blob-2" />
          <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-gradient-to-br from-cyan-200/25 to-sky-200/20 rounded-full blur-3xl dash-blob-3" />
          <div className="absolute top-2/3 left-1/3 w-56 h-56 bg-gradient-to-br from-rose-100/15 to-pink-100/10 rounded-full blur-3xl dash-blob-1" />
        </div>
        <div className="relative px-4 md:px-6 py-4 md:py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
