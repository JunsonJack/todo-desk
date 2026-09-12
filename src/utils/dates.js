export const STATUS_META = {
  todo: { label: '待办', className: 'status-todo' },
  doing: { label: '进行中', className: 'status-doing' },
  done: { label: '已完成', className: 'status-done' },
};

export const FALLBACK_PRIORITY_META = {
  urgent: { code: 'urgent', label: '紧急', short: '紧急', color: '#FF453A', weight: 0, className: 'p-dynamic' },
  high: { code: 'high', label: '高', short: '高', color: '#FF9F0A', weight: 1, className: 'p-dynamic' },
  medium: { code: 'medium', label: '中', short: '中', color: '#0A84FF', weight: 2, className: 'p-dynamic' },
  low: { code: 'low', label: '低', short: '低', color: '#8E8E93', weight: 3, className: 'p-dynamic' },
};

export function buildPriorityMap(priorities = []) {
  const map = {};
  priorities.forEach((p, index) => {
    map[p.code] = {
      code: p.code,
      label: p.name,
      short: p.name,
      color: p.color || '#0A84FF',
      weight: p.sort_order ?? index,
      className: 'p-dynamic',
    };
  });
  if (Object.keys(map).length === 0) return { ...FALLBACK_PRIORITY_META };
  return map;
}

export function getPriorityMeta(task, priorityMap) {
  const code = task?.priority;
  return priorityMap?.[code]
    || FALLBACK_PRIORITY_META[code]
    || {
      code,
      label: task?.priority_name || code || '—',
      short: task?.priority_name || code || '—',
      color: task?.priority_color || '#8E8E93',
      weight: task?.priority_sort ?? 99,
      className: 'p-dynamic',
    };
}

export function pad(n) {
  return String(n).padStart(2, '0');
}

export function toDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayStr() {
  return toDateStr(new Date());
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

export function startOfWeek(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  return toDateStr(d);
}

export function weekDays(dateStr) {
  const start = startOfWeek(dateStr);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function monthMatrix(year, month) {
  // month: 0-based
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const gridStart = new Date(year, month, 1 - startDay);
  const weeks = [];
  let cursor = new Date(gridStart);

  for (let w = 0; w < 6; w += 1) {
    const week = [];
    for (let d = 0; d < 7; d += 1) {
      week.push({
        date: toDateStr(cursor),
        day: cursor.getDate(),
        inMonth: cursor.getMonth() === month,
        isToday: toDateStr(cursor) === todayStr(),
      });
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export function formatDateCN(dateStr) {
  if (!dateStr) return '未安排日期';
  const d = new Date(`${dateStr}T00:00:00`);
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日 周${week}`;
}

export function isOverdue(task) {
  if (!task.due_date || task.status === 'done') return false;
  return task.due_date < todayStr();
}

export function sortByTasks(list, priorityMap = null) {
  return [...list].sort((a, b) => {
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (a.status !== 'done' && b.status === 'done') return -1;
    const pa = a.priority_sort ?? getPriorityMeta(a, priorityMap).weight ?? 9;
    const pb = b.priority_sort ?? getPriorityMeta(b, priorityMap).weight ?? 9;
    if (pa !== pb) return pa - pb;
    const da = a.due_date || '9999-12-31';
    const db = b.due_date || '9999-12-31';
    if (da !== db) return da < db ? -1 : 1;
    return b.id - a.id;
  });
}
