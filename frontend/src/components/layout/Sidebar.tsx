import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
  ADMIN_ROLES,
  DIRECTORY_ROLES,
  ROLE_LABELS,
  ROLES,
  TA_ROLES,
  type UserRole,
} from '@/constants/roles';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  allowedRoles?: readonly UserRole[];
}

/**
 * Role groups come from @/constants/roles — the SAME module the router uses.
 * Previously the sidebar declared its own copies of ADMIN_ROLES / ALL_ROLES
 * (and a 'student' role the backend does not have), which let navigation and
 * route guards drift apart.
 */
const navItems: NavItem[] = [
  { label: 'خانه', path: '/', icon: '🏠' },
  { label: 'داشبورد مدیر کل', path: '/admin-dashboard', icon: '🛠️', allowedRoles: ADMIN_ROLES },
  { label: 'مدیریت ترم‌ها', path: '/admin-semester', icon: '📅', allowedRoles: ADMIN_ROLES },
  { label: 'مدیریت اساتید', path: '/faculty-management', icon: '👨‍🏫', allowedRoles: ADMIN_ROLES },
  { label: 'دایرکتوری دروس', path: '/courses', icon: '📚', allowedRoles: DIRECTORY_ROLES },
  { label: 'پایش حجم کاری', path: '/workload', icon: '📊', allowedRoles: ADMIN_ROLES },
  { label: 'مدیریت تخصیص‌ها', path: '/assignments', icon: '🗂️', allowedRoles: ADMIN_ROLES },
  { label: 'داشبورد استاد', path: '/professor-dashboard', icon: '🎓', allowedRoles: [ROLES.PROFESSOR] },
  { label: 'دستیار آموزشی من', path: '/my-ta-courses', icon: '📝', allowedRoles: TA_ROLES },
];

interface SidebarProps {
  /** Called after a navigation, so the mobile drawer can close itself. */
  onNavigate?: () => void;
}

const Sidebar = ({ onNavigate }: SidebarProps) => {
  // Selectors, not `useAuthStore()`: this component no longer re-renders on
  // every unrelated store change.
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const accessibleItems = navItems.filter(
    (item) => !item.allowedRoles || (user ? item.allowedRoles.includes(user.role) : false),
  );

  return (
    <aside className="flex h-full w-64 flex-col bg-gray-800 text-white">
      <div className="flex items-center justify-center border-b border-gray-700 p-4">
        <span className="text-xl font-bold">TAMS</span>
      </div>

      <nav aria-label="منوی اصلی" className="flex-1 space-y-1 overflow-y-auto p-4">
        {accessibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center rounded-md px-4 py-2 text-sm transition-colors ${
                isActive ? 'bg-brand-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`
            }
          >
            {/* Decorative emoji: hidden from screen readers, the label carries the meaning. */}
            <span className="ml-3" aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {user && (
        <div className="border-t border-gray-700 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.first_name || user.username}</p>
              <p className="truncate text-sm text-gray-400">{ROLE_LABELS[user.role]}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="shrink-0 rounded-md bg-red-600 px-3 py-1 text-sm font-medium hover:bg-red-700"
            >
              خروج
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
