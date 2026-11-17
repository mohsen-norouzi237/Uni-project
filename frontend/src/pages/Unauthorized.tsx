import React from 'react';
import { Link } from 'react-router-dom';

const Unauthorized: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen text-center">
      <h1 className="text-4xl font-bold text-red-600">403</h1>
      <p className="text-xl mt-4">شما دسترسی لازم برای مشاهده این صفحه را ندارید.</p>
      <Link to="/" className="mt-6 text-blue-500 hover:underline">
        بازگشت به صفحه اصلی
      </Link>
    </div>
  );
};

export default Unauthorized;
