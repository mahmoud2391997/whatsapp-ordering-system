import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'المتجر مغلق حالياً - Fresh Greens',
  description: 'المتجر حاليا قيد الصيانة',
};

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {/* Logo */}
        <div className="w-20 h-20 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
          <span className="text-white text-2xl font-bold">FG</span>
        </div>

        {/* Main heading */}
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          المتجر مغلق حالياً
        </h1>

        {/* Message */}
        <p className="text-gray-600 text-lg mb-6 leading-relaxed">
          عذرا عزيزي العميل، المتجر حاليا قيد الصيانة و سنعاود العمل خلال فترة وجيزة
        </p>

        {/* Divider */}
        <div className="w-16 h-1 bg-emerald-200 mx-auto mb-6 rounded-full"></div>

        {/* Thank you message */}
        <p className="text-emerald-700 font-medium mb-8">
          شكرا لتفهمكم
        </p>

        {/* Animated dots */}
        <div className="flex justify-center gap-2 mb-6">
          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>

        {/* Footer */}
        <p className="text-gray-400 text-sm">
          Fresh Greens - خضروات وفواكه طازجة
        </p>
      </div>
    </div>
  );
}
