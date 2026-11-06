const { contextBridge, ipcRenderer } = require('electron');

const LISTEN = ['wheel:open', 'wheel:hover', 'wheel:close', 'wheel:toast', 'wheel:layout', 'status', 'input', 'search:open'];

contextBridge.exposeInMainWorld('ew', {
  on: (channel, fn) => {
    if (LISTEN.includes(channel)) ipcRenderer.on(channel, (_e, data) => fn(data));
  },
  invoke: (channel, ...args) => {
    if (channel.startsWith('settings:') || channel.startsWith('search:')) return ipcRenderer.invoke(channel, ...args);
    return Promise.reject(new Error(`Blocked channel ${channel}`));
  },
  click: () => ipcRenderer.send('wheel:click'),
});
