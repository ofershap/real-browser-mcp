const TAB_GROUP_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
const TAB_GROUPS_STORAGE_KEY = 'TAB_GROUPS';

/** Per-key promise chain so overlapping work on the same tab cannot race. */
function createSerialQueue() {
  let tail = Promise.resolve();
  return (fn) => {
    const run = tail.then(() => fn(), () => fn());
    tail = run.then(() => undefined, () => undefined);
    return run;
  };
}

/**
 * Tab group helpers used by the extension service worker.
 * Accepts a chrome API object so tests can inject a mock.
 */
export function createTabGroups(chrome) {
  const noneId = chrome.tabGroups?.TAB_GROUP_ID_NONE ?? -1;
  /** Group IDs created by this extension; we only rename these. */
  const managedGroupIds = new Set();
  let tabGroupsLoaded = null;
  const tabLocks = new Map();

  function withTabLock(tabId, fn) {
    let enqueue = tabLocks.get(tabId);
    if (!enqueue) {
      enqueue = createSerialQueue();
      tabLocks.set(tabId, enqueue);
    }
    return enqueue(fn);
  }

  async function ensureLoaded() {
    if (tabGroupsLoaded) return tabGroupsLoaded;
    tabGroupsLoaded = (async () => {
      try {
        const stored = await chrome.storage.local.get(TAB_GROUPS_STORAGE_KEY);
        const data = stored[TAB_GROUPS_STORAGE_KEY];
        const ids = Array.isArray(data)
          ? data
          : (data?.groups ?? []).map((g) => g.chromeGroupId);
        for (const id of ids) {
          if (typeof id === 'number') managedGroupIds.add(id);
        }
      } catch {}
    })();
    return tabGroupsLoaded;
  }

  async function saveManagedGroups() {
    await chrome.storage.local.set({
      [TAB_GROUPS_STORAGE_KEY]: {
        groups: [...managedGroupIds].map((chromeGroupId) => ({ chromeGroupId })),
      },
    });
  }

  function randomGroupColor() {
    return TAB_GROUP_COLORS[Math.floor(Math.random() * TAB_GROUP_COLORS.length)];
  }

  function trimGroupTitle(title) {
    if (typeof title !== 'string') return '';
    return title.trim();
  }

  function isGrouped(groupId) {
    return typeof groupId === 'number' && groupId !== noneId;
  }

  async function readTabGroup(groupId) {
    if (!chrome.tabGroups?.get || groupId == null || groupId === noneId) return null;
    try {
      return await chrome.tabGroups.get(groupId);
    } catch {
      return null;
    }
  }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab');
    return tab;
  }

  async function resolveTabsTarget(tabId) {
    if (tabId) return chrome.tabs.get(tabId);
    return getActiveTab();
  }

  async function nameLocked(tabId, trimmed, color) {
    const tab = await chrome.tabs.get(tabId);
    if (!tab?.id) throw new Error('No tab to group');

    let groupId = tab.groupId;
    const alreadyManaged = isGrouped(groupId) && managedGroupIds.has(groupId);

    if (!alreadyManaged) {
      groupId = await chrome.tabs.group({ tabIds: [tab.id] });
      managedGroupIds.add(groupId);
      await saveManagedGroups();
    }

    const update = { title: trimmed };
    if (color && TAB_GROUP_COLORS.includes(color)) update.color = color;
    else if (!alreadyManaged) update.color = randomGroupColor();

    if (chrome.tabGroups?.update) {
      await chrome.tabGroups.update(groupId, update);
    }

    const group = await readTabGroup(groupId);
    return {
      success: true,
      groupId,
      title: group?.title ?? trimmed,
      color: group?.color ?? update.color,
      tabId: tab.id,
    };
  }

  async function ungroupLocked(tabId) {
    const tab = await chrome.tabs.get(tabId);
    if (!tab?.id) throw new Error('No tab to ungroup');

    const groupId = tab.groupId;
    if (!isGrouped(groupId)) {
      return { success: true, tabId: tab.id, ungrouped: false };
    }

    await chrome.tabs.ungroup(tab.id);
    const remaining = await chrome.tabs.query({ groupId });
    if (remaining.length === 0) {
      managedGroupIds.delete(groupId);
      await saveManagedGroups();
    }
    return { success: true, tabId: tab.id, ungrouped: true, groupId };
  }

  if (chrome.tabGroups?.onRemoved?.addListener) {
    chrome.tabGroups.onRemoved.addListener((group) => {
      if (managedGroupIds.delete(group.id)) saveManagedGroups();
    });
  }

  return {
    ensureLoaded,

    async name({ title, color, tabId }) {
      await ensureLoaded();
      const trimmed = trimGroupTitle(title);
      if (!trimmed) throw new Error('title is required');

      const tab = await resolveTabsTarget(tabId);
      if (!tab?.id) throw new Error('No tab to group');
      return withTabLock(tab.id, () => nameLocked(tab.id, trimmed, color));
    },

    async ungroup({ tabId }) {
      await ensureLoaded();
      const tab = await resolveTabsTarget(tabId);
      if (!tab?.id) throw new Error('No tab to ungroup');
      return withTabLock(tab.id, () => ungroupLocked(tab.id));
    },

    async list() {
      await ensureLoaded();
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const groupCache = new Map();
      const result = [];

      for (const t of tabs) {
        const item = { id: t.id, url: t.url, title: t.title, active: t.active };
        if (isGrouped(t.groupId)) {
          item.groupId = t.groupId;
          if (!groupCache.has(t.groupId)) {
            groupCache.set(t.groupId, await readTabGroup(t.groupId));
          }
          const g = groupCache.get(t.groupId);
          if (g) {
            item.groupTitle = g.title ?? '';
            item.groupColor = g.color;
          }
        }
        result.push(item);
      }

      return { success: true, tabs: result };
    },
  };
}
