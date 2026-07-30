import Image from 'next/image';

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-blue-900">
      <div className="animate-pulse">
        <Image src="/logo.png" alt="Logo" width={120} height={120} />
      </div>
      <h1 className="text-white text-2xl font-bold mt-6">Nishadi Enterprise Suite</h1>
      <p className="text-blue-200 text-sm mt-2">Point of Sale & Management</p>
      <div className="absolute bottom-8 text-center">
        <p className="text-blue-300 text-xs">Powered by</p>
        <p className="text-white text-sm font-semibold">Ceylon Digi Solutions</p>
      </div>
    </div>
  );
}