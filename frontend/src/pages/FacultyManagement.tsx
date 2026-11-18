import { useQuery } from '@tanstack/react-query';
import DataTable, { type Column } from '@/components/DataTable';
import DataTableSkeleton from '@/components/DataTableSkeleton';
import Badge from '@/components/Badge';
import ErrorState from '@/components/ErrorState';
import Pagination from '@/components/Pagination';
import { usePagination } from '@/hooks/usePagination';
import { ROLES } from '@/constants/roles';
import PageContainer from '@/components/PageContainer';
import { usersKeys, usersService, type FacultyUser } from '@/services/users.service';

/**
 * Faculty & TA roster — wired to GET /api/v1/users/?role=...
 * (accounts UserViewSet). Previously this page was a static <div> with a
 * Persian title and no data at all.
 */
const ROLE_COLUMNS: FacultyUser['role'][] = [ROLES.PROFESSOR, ROLES.HEAD_TA, ROLES.TA];

const columns: Column<FacultyUser>[] = [
  {
    header: 'نام و نام خانوادگی',
    accessor: (item) => (
      <span className="font-semibold text-gray-800">
        {`${item.first_name} ${item.last_name}`.trim() || item.username}
      </span>
    ),
    sortable: true,
    sortKey: 'last_name',
  },
  { header: 'نام کاربری', accessor: (item) => <code dir="ltr">{item.username}</code>, sortKey: 'username', sortable: true },
  { header: 'ایمیل', accessor: (item) => <span dir="ltr" className="text-sm text-gray-600">{item.email || '—'}</span> },
  {
    header: 'نقش',
    accessor: (item) => (
      <Badge variant={item.role === ROLES.PROFESSOR ? 'info' : 'default'}>{item.role.replace('_', ' ').toUpperCase()}</Badge>
    ),
    sortable: true,
    sortKey: 'role',
  },
  {
    header: 'وضعیت',
    accessor: (item) => (
      <Badge variant={item.is_active ? 'success' : 'danger'}>{item.is_active ? 'فعال' : 'غیرفعال'}</Badge>
    ),
  },
];

const FacultySection = ({ role }: { role: FacultyUser['role'] }) => {
  const pageSize = 10;
  const { page, bind } = usePagination(pageSize);
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: [...usersKeys.faculty(), role, page],
    queryFn: () => usersService.listByRole(role, page, pageSize),
  });

  const pagination = bind(data);

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">
        {role === ROLES.PROFESSOR ? 'اساتید' : role === ROLES.HEAD_TA ? 'سرگروه‌های دستیاران' : 'دستیاران آموزشی'}
      </h2>
      {isPending ? (
        <DataTableSkeleton rows={4} columns={5} />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <>
          <DataTable data={data.results} columns={columns} paginate={false} emptyMessage="کاربری با این نقش یافت نشد." />
          <Pagination {...pagination} onPrevious={pagination.goPrevious} onNext={pagination.goNext} isFetching={isFetching} />
        </>
      )}
    </section>
  );
};

const FacultyManagement = () => (
  <PageContainer
    title="مدیریت اساتید و دانشکده"
    description="فهرست کامل اساتید، سرگروه‌ها و دستیاران آموزشی از سامانه مرکزی"
  >
    <div className="space-y-6">
      {ROLE_COLUMNS.map((role) => (
        <FacultySection key={role} role={role} />
      ))}
    </div>
  </PageContainer>
);

export default FacultyManagement;
