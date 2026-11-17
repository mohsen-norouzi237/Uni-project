import React from 'react';
import Skeleton from './skeleton';

interface DataTableSkeletonProps {
  rows?: number;
  columns?: number;
}

export const DataTableSkeleton: React.FC<DataTableSkeletonProps> = ({
  rows = 5,
  columns = 4,
}) => {
  return (
    <div className="w-full space-y-4">
      <div className="w-full overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="w-full text-right">
          {/* هدر اسکلتون */}
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <th key={colIndex} className="px-6 py-3">
                  <Skeleton className="h-4 w-24 bg-gray-300" />
                </th>
              ))}
            </tr>
          </thead>
          {/* سطر‌های اسکلتون */}
          <tbody className="divide-y divide-gray-200 bg-white">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <td key={colIndex} className="px-6 py-4">
                    <Skeleton className="h-4 w-full" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTableSkeleton;