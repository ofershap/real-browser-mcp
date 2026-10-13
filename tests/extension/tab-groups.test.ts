import { describe, it, expect, vi } from 'vitest';
import { createTabGroups } from '../../extension/tab-groups.js';

function createChrome({ tabId = 7 } = {}) {
  const tabState = {
    id: tabId,
    groupId: -1,
    url: 'https://example.com',
    title: 'Example',
    active: true,
  };
  const groupsById = new Map();
  let nextGroupId = 42;
  let releaseGroup;
  const groupGate = new Promise((resolve) => {
    releaseGroup = resolve;
  });
  let resolveEntered;
  const enteredGroup = new Promise((resolve) => {
    resolveEntered = resolve;
  });

  const chrome = {
    tabGroups: {
      TAB_GROUP_ID_NONE: -1,
      get: vi.fn(async (id) => groupsById.get(id) ?? null),
      update: vi.fn(async (id, update) => {
        const g = groupsById.get(id) || { id };
        Object.assign(g, update);
        groupsById.set(id, g);
      }),
    },
    tabs: {
      get: vi.fn(async () => ({ ...tabState })),
      query: vi.fn(async (query = {}) => {
        if (query.groupId != null) {
          return tabState.groupId === query.groupId ? [{ ...tabState }] : [];
        }
        return [{ ...tabState }];
      }),
      group: vi.fn(async () => {
        resolveEntered();
        await groupGate;
        const groupId = nextGroupId++;
        tabState.groupId = groupId;
        groupsById.set(groupId, { id: groupId, title: '', color: 'grey' });
        return groupId;
      }),
      ungroup: vi.fn(async () => {
        tabState.groupId = -1;
      }),
    },
    storage: {
      local: {
        get: vi.fn(async () => ({})),
        set: vi.fn(async () => {}),
      },
    },
  };

  return { chrome, tabState, enteredGroup, releaseGroup: () => releaseGroup() };
}

describe('tab groups', () => {
  it('creates only one group when two name calls overlap on the same ungrouped tab', async () => {
    const { chrome, enteredGroup, releaseGroup } = createChrome();
    const api = createTabGroups(chrome);

    const first = api.name({ title: 'Alpha', color: 'blue', tabId: 7 });
    const second = api.name({ title: 'Beta', color: 'red', tabId: 7 });

    await enteredGroup;
    await new Promise((r) => setTimeout(r, 0));
    expect(chrome.tabs.group).toHaveBeenCalledTimes(1);

    releaseGroup();
    const [a, b] = await Promise.all([first, second]);

    expect(chrome.tabs.group).toHaveBeenCalledTimes(1);
    expect(a.groupId).toBe(42);
    expect(b.groupId).toBe(42);
    expect(b.title).toBe('Beta');
  });

  it('updates an existing managed group without creating another', async () => {
    const { chrome, enteredGroup, releaseGroup } = createChrome();
    const api = createTabGroups(chrome);

    const first = api.name({ title: 'Alpha', color: 'blue', tabId: 7 });
    await enteredGroup;
    releaseGroup();
    await first;

    const second = await api.name({ title: 'Beta', color: 'red', tabId: 7 });
    expect(chrome.tabs.group).toHaveBeenCalledTimes(1);
    expect(second.groupId).toBe(42);
    expect(second.title).toBe('Beta');
    expect(second.color).toBe('red');
  });
});
