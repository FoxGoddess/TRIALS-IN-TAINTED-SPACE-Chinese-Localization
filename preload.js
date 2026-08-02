const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld('electronAPI', {
	checkManifest: () => ipcRenderer.invoke("acquireImages:checkManifest"),
	notifyHasImagesAvailable: (callback) => ipcRenderer.on("acquireImages:notifyAvailable", callback),

	downloadImages: () => ipcRenderer.invoke("acquireImages:start"),
	notifyDownloadProgress: (callback) => ipcRenderer.on("acquireImages:notifyProgress", callback),
	downloadImagesCancel: () => ipcRenderer.invoke("acquireImages:cancel"),
	notifyDownloadComplete: (callback) => ipcRenderer.on("acquireImages:downloadComplete", callback),

	onTriggerRedraw: (callback) => ipcRenderer.on("display:triggerRedraw", callback),
	forceReload: () => ipcRenderer.invoke("display:forceReload"),

	saveFile: async (fileName, data) => await ipcRenderer.invoke("file:save", fileName, data),
	loadFile: async (fileName) => await ipcRenderer.invoke("file:load", fileName),
	deleteFile: async (fileName) => await ipcRenderer.invoke("file:delete", fileName),
	resetData: async () => await ipcRenderer.invoke("file:reset")
});