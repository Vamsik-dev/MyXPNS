import type { Route } from '../app/router';
import { hrefFor } from '../app/router';
import type { IconName } from './Icon';
import { Icon } from './Icon';

const TABS: { name: Exclude<Route['name'], 'add'>; label: string; icon: IconName }[] = [
  { name: 'home', label: 'Home', icon: 'home' },
  { name: 'transactions', label: 'Transactions', icon: 'list' },
  { name: 'reports', label: 'Reports', icon: 'chart' },
  { name: 'settings', label: 'Settings', icon: 'gear' },
];

export function TabBar({ active }: { active: Route['name'] }) {
  return (
    <nav aria-label="Main" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 backdrop-blur-xl">
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {TABS.map((t) => {
          const isActive = t.name === active;
          return (
            <li key={t.name}>
              <a
                href={hrefFor({ name: t.name } as Route)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${isActive ? 'text-accent' : 'text-muted'}`}
              >
                <Icon name={t.icon} className="size-6" />
                {t.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
