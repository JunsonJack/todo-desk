export const API = {
  tasks: {
    list: (filters) => window.api.tasks.list(filters),
    create: (input) => window.api.tasks.create(input),
    update: (id, patch) => window.api.tasks.update(id, patch),
    remove: (id) => window.api.tasks.remove(id),
  },
  projects: {
    list: () => window.api.projects.list(),
    create: (input) => window.api.projects.create(input),
    update: (id, patch) => window.api.projects.update(id, patch),
    remove: (id) => window.api.projects.remove(id),
  },
  priorities: {
    list: async () => {
      if (!window.api?.priorities?.list) return [];
      return window.api.priorities.list();
    },
    create: async (input) => {
      if (!window.api?.priorities?.create) {
        throw new Error('当前窗口尚未加载紧急程度接口，请完全退出并重启应用');
      }
      return window.api.priorities.create(input);
    },
    update: async (id, patch) => {
      if (!window.api?.priorities?.update) {
        throw new Error('当前窗口尚未加载紧急程度接口，请完全退出并重启应用');
      }
      return window.api.priorities.update(id, patch);
    },
    remove: async (id) => {
      if (!window.api?.priorities?.remove) {
        throw new Error('当前窗口尚未加载紧急程度接口，请完全退出并重启应用');
      }
      return window.api.priorities.remove(id);
    },
    move: async (id, direction) => {
      if (!window.api?.priorities?.move) {
        throw new Error('当前窗口尚未加载紧急程度接口，请完全退出并重启应用');
      }
      return window.api.priorities.move(id, direction);
    },
    reorder: async (orderedIds) => {
      if (!window.api?.priorities?.reorder) {
        throw new Error('当前窗口尚未加载紧急程度排序接口，请完全退出并重启应用');
      }
      return window.api.priorities.reorder(orderedIds);
    },
  },
  stats: {
    get: () => window.api.stats.get(),
  },
};

export const NAV_ITEMS = [
  { id: 'list', label: '列表', icon: '☰' },
  { id: 'today', label: '今日', icon: '☀' },
  { id: 'week', label: '每周', icon: '▦' },
  { id: 'calendar', label: '日历', icon: '▣' },
  { id: 'project', label: '项目', icon: '◈' },
  { id: 'settings', label: '设置', icon: '⚙' },
];
