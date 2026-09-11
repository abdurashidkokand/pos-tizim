'use client';

import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-red-500">403</h1>
        <p className="text-xl text-gray-600 mt-4">Ruxsat yo'q</p>
        <p className="text-gray-400 mt-2">
          Bu sahifaga kirishga huquqingiz yo'q.
        </p>
        <Link
          href="/dashboard"
          className="inline-block mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Bosh sahifaga qaytish
        </Link>
      </div>
    </div>
  );
}
