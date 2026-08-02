const { app, BrowserWindow, ipcMain, protocol } = require("electron");
const path = require('path');
const fs = require("fs");
const crypto = require("crypto");
const http2 = require("http2");

let win;

const PROTO_SCHEME = "tits";
const DIST_PATH = path.join(__dirname, "../../resources/app");
const CACHE_PATH = path.join(app.getPath("userData"), "ImagePack");
const APP_BASE_HOST = `titsapp`;

const USE_PROD = true;
let baseURI;
let serverHost;
let connectionOptions = {};

if (USE_PROD)
{
	baseURI = `https://www.fenoxo.com/play/TiTS/release/`;
	serverHost = `https://www.fenoxo.com`;
}
else
{
	baseURI = `https://localhost:4444/`;
	serverHost = `https://localhost:4444`;
	connectionOptions.rejectUnauthorized = false;
}

/**
 * If you're reading this, yes I am aware how easy it would be to modify this to make it possible for public builds to get the bigger images.
 * If you figure it out, please keep it to yourself - the restriction isn't about punishing or keeping things back from public builds,
 * but trying to ease in to the bandwidth demand that this is going to place on our server. 
 * The larger images are a huge amount of data per user - I (Gedan) will have to spend time to engineer better solutions, time that I could
 * spend on game content...
 */
const packSizes = ["x2"];

class ProtoHandler
{
	static requestHandler(req, next)
	{
		const reqUrl = new URL(req.url);

		let reqPath = path.normalize(reqUrl.pathname);
		if (reqPath === "/") 
		{
			reqPath = "/index.html";
		}
	
		const imgPack = reqPath.includes("x2") || reqPath.includes("x4");
		const fullPath = path.join(imgPack ? CACHE_PATH : DIST_PATH, reqPath);
		next(fullPath);
	}
}

protocol.registerSchemesAsPrivileged([{
	scheme: PROTO_SCHEME,
	privileges: {
		standard: true,
		secure: true
	}
}]);

function createWindow()
{
	protocol.registerFileProtocol(PROTO_SCHEME, ProtoHandler.requestHandler);

    win = new BrowserWindow({ 
        width: 1920,
        minWidth: 640, 
        height: 1080, 
        minHeight: 360,
		backgroundColor: "#2C3649",
		useContentSize: true,
        frame: true, 
        closable: true,
        autoHideMenuBar: true,
        webPreferences: {
            devTools: true,
            preload: path.join(__dirname, '/preload.js'),
			nodeIntegration: true
        },
		show: false
    });
    
    win.loadURL(`${PROTO_SCHEME}://${APP_BASE_HOST}/index.html`);

    win.on("close", () => 
	{
        win = null;
        app.exit(0);
    });

	win.once("ready-to-show", () => 
	{
		win.show();
	});
}

app.whenReady().then(() => 
{
	ipcMain.handle("acquireImages:start", handleAcquireImages);
	ipcMain.handle("acquireImages:cancel", handleCancelImages);
	ipcMain.handle("acquireImages:delete", handleDeleteImages);
	ipcMain.handle("acquireImages:checkManifest", checkImageManifest);
	ipcMain.handle("display:forceReload", forceReload);

	ipcMain.handle("file:save", handleFileSave);
	ipcMain.handle("file:load", handleFileLoad);
	ipcMain.handle("file:delete", handleDeleteFile);
	ipcMain.handle("file:reset", handleFileReset);
	createWindow();
});

app.on("window-all-closed", () => 
{
    app.exit(0);
});

app.on("browser-window-focus", () => 
{
	win.webContents.send("display:triggerRedraw");
})

function forceReload()
{
	console.log("Attempting to force reload window...");
	app.relaunch();
	app.exit();
}

const GAME_DATA_PATH = path.join(app.getPath("userData"), "GameData");

function sanitizePath(targetFileName)
{
	let filt = path.normalize(targetFileName).split(path.sep).filter(s => s !== "..");
	if (filt.length > 0) return path.join(...filt);
	else return filt[0];
}

function handleFileReset()
{
	if (fs.existsSync(GAME_DATA_PATH))
	{
		fs.rmdirSync(GAME_DATA_PATH);
	}
}

async function handleFileSave(__event, targetFileName, data)
{
	let wasSuccess = true;

	if (!fs.existsSync(GAME_DATA_PATH))
	{
		fs.mkdirSync(GAME_DATA_PATH);
	}

	if (typeof data !== "string")
	{
		console.error("Invalid type for save data.");
		return false;
	}

	targetFileName = sanitizePath(targetFileName);

	let targetPath = path.join(GAME_DATA_PATH, `${targetFileName}.json`);
	let backupPath = path.join(GAME_DATA_PATH, `${targetFileName}_backup.json`);
	let createdBackupFile = false;

	// atomically ensure the existing data does not disappear by copying it to a secondary file
	try
	{
		if (fs.existsSync(targetPath))
		{
			if (fs.existsSync(backupPath))
			{
				fs.rmSync(backupPath);
			}
			
			console.log(`Creating backup file ${backupPath}`);
			fs.copyFileSync(targetPath, backupPath);
			createdBackupFile = true;
		}
	}
	catch (e)
	{
		console.error(`Failed to write save backup file for ${targetFileName}: ${e.message}`);
		wasSuccess = false;
	}

	if (createdBackupFile)
	{
		try
		{
			fs.rmSync(targetPath);
		}
		catch(e)
		{
			console.error(`Failed to free target filename: ${e.message}`);
			wasSuccess = false;
		}
	}
	
	try
	{
		console.log(`Creating file ${targetPath}`);
		fs.writeFileSync(targetPath, data);
	}
	catch(e)
	{
		console.error(`Failed to write save data: ${e.message}`);
		wasSuccess = false;
	}

	return wasSuccess;
}

async function handleFileLoad(__event, targetFileName)
{
	if (!fs.existsSync(GAME_DATA_PATH))
	{
		fs.mkdirSync(GAME_DATA_PATH);
		return null;
	}

	targetFileName = sanitizePath(targetFileName);

	let targetPath = path.join(GAME_DATA_PATH, `${targetFileName}.json`);
	let backupPath = path.join(GAME_DATA_PATH, `${targetFileName}_backup.json`);
	let fileData = null;
	let parsedFileData = null;

	try
	{
		if (fs.existsSync(targetPath))
		{
			console.log(`Loading file ${targetPath}`);
			fileData = fs.readFileSync(targetPath, { encoding: "utf8" });
			if (fileData)
			{
				parsedFileData = JSON.parse(fileData);
			}
		}
	}
	catch (e)
	{
		console.log(`File ${targetPath} does not exist or there was a problem parsing the file contents. ${e}`);
	}

	if (parsedFileData)
	{
		return fileData;
	}

	try
	{
		if (fs.existsSync(backupPath))
		{
			console.log(`Loading file ${targetPath}`);
			fileData = fs.readFileSync(backupPath, { encoding: "utf8" });
			if (fileData)
			{
				parsedFileData = JSON.parse(fileData);
			}
		}
	}
	catch (e)
	{
		console.log(`File ${backupPath} does not exist or there was a problem parsing the file contents. ${e}`);
	}

	if (parsedFileData)
	{
		try
		{
			// copy the backup over the original
			if (fs.existsSync(targetPath))
			{
				fs.rmSync(targetPath);
			}

			fs.copyFileSync(backupPath, targetPath);
		}
		catch (e)
		{
			console.log(`Failed to move working backup file over broken target file: ${e}`);
		}

		return fileData;
	}

	return null;
}

async function handleDeleteFile(__event, targetFileName)
{
	targetFileName = sanitizePath(targetFileName);

	let targetPath = path.join(GAME_DATA_PATH, `${targetFileName}.json`);
	let backupPath = path.join(GAME_DATA_PATH, `${targetFileName}_backup.json`);

	try
	{
		if (fs.existsSync(targetPath))
		{
			console.log(`Deleting file ${targetPath}`);
			fs.rmSync(targetPath)
		}

		if (fs.existsSync(backupPath))
		{
			console.log(`Deleting file ${backupPath}`);
			fs.rmSync(backupPath);
		}
	}
	catch (e)
	{
		console.error(`Failed to delete file from "${targetFileName}: ${e.message}`);
	}
}

let downloadInProgress = false;
let cancelAcquisition = false;
let imagesRequiringUpdate = null;
let imagesRequiringRetry = null;

let session = null;
let numTransferred = 0;

/**
 * This place is a message and part of a system of messages. Pay attention to it!
 * Sending this message was important to us. We considered ourselves to be a powerful culture.
 * This place is not a place of honor, no highly esteemed deed is commemorated here. Nothing valued is here.
 * What is here was dangerous and repulsive to us. This message is a warning about danger.
 * The danger is in a particular location. It increases towards a center. The center of danger is here, of a particular size and shape, below us.
 * The danger is still present, in your time as it was in ours.
 * The danger is to the mind, and it can kill.
 * The form of the danger is an emanation of energy.
 * The danger is unleashed only if you substatially disturb this place physically. This place is best shunned and left uninhabited.
 */

function doRequest(s, target, uri)
{
	const fw = fs.createWriteStream(target);

	return new Promise((resolve, reject) => 
	{
		const path = (new URL(uri)).pathname;
		const req = s.request({ ":path": path });

		req.pipe(fw);

		fw.on("finish", () => 
		{
			fw.close();
			req.end();
			numTransferred++;
			win.webContents.send("acquireImages:notifyProgress", numTransferred);
			resolve(true);
		});

		req.on("error", (error) => 
		{
			console.log(error);

			if (!imagesRequiringRetry)
			{
				imagesRequiringRetry = [];
			}

			imagesRequiringRetry.push({ target: target, source: uri });

			reject(error);
		});
	});
}

let RECREATE_SESSION = false;

function createSession()
{
	let s = http2.connect(serverHost, connectionOptions);
	RECREATE_SESSION = true;

	s.on("error", (error) =>
	{
		console.log(error);
	});

	// This realistically needs a good way to stall out the outer loop because we can shotgun every request into a failed half-open session otherwise...
	s.on("goaway", (__code, __sID, __data) =>
	{
		if (RECREATE_SESSION)
		{
			s = http2.connect(serverHost, connectionOptions);
		}
	});

	return s;
}

function closeSession(s)
{
	RECREATE_SESSION = false;
	s.close();
}

async function handleAcquireImages()
{
	if (imagesRequiringUpdate === null || imagesRequiringUpdate.length === 0)
	{
		return false;
	}

	const sleepWait = ms => new Promise(r => setTimeout(r, ms));

	downloadInProgress = true;
	const basePath = path.join(app.getPath("userData"), "ImagePack");
	console.log(`Base Path: ${basePath}`);

	try
	{
		fs.mkdirSync(basePath);
	}
	catch (error)
	{
		if (error.code !== "EEXIST")
		{
			throw error;
		}
	}

	let requestTasks = [];
	const concurrencyLimit = 10;
	let fileId = 0;

	const chunkSize = 500;
	let chunkedList = [];

	for (let i = 0; i < imagesRequiringUpdate.length; i += chunkSize)
	{
		chunkedList.push(imagesRequiringUpdate.slice(i, i + chunkSize));
	}

	for (const chunk of chunkedList)
	{
		session = createSession();

		for (const i of chunk)
		{
			if (requestTasks.length >= concurrencyLimit)
			{
				await Promise.race(requestTasks);
			}

			console.log(`Downloading asset [${fileId++}] ${i.source}`);

			// Ensure the target folder exists

			if (cancelAcquisition)
			{
				break;
			}
			
			await fs.promises.mkdir(path.dirname(i.target), { recursive: true });
			const oneRequest = doRequest(session, i.target, i.source).then(() => 
			{
				requestTasks.splice(requestTasks.indexOf(oneRequest), 1);
			}).catch(() => 
			{
				requestTasks.splice(requestTasks.indexOf(oneRequest), 1);
			})
			requestTasks.push(oneRequest);
		}

		closeSession(session);
		while (!session.closed)
		{
			console.log("Waiting to recycle session...");
			await sleepWait(1000);
		}
	}

	console.log("Waiting for in-flight requests...");
	await Promise.all(requestTasks);	

	// If we have ANY failures, recreate the session and commence trying again
	if (imagesRequiringRetry && imagesRequiringRetry.length > 0)
	{
		closeSession(session);
		session = createSession();

		const retryCount = 2;
		for (let i = 0; i < retryCount; i++)
		{
			let failingListCopy = imagesRequiringRetry;
			imagesRequiringRetry = [];

			if (!Array.isArray(failingListCopy) || failingListCopy.length === 0)
			{
				console.log("There are no active elements to retry, aborting.")
				break;
			}

			for (const i of failingListCopy)
			{
				if (requestTasks.length >= concurrencyLimit)
				{
					await Promise.race(requestTasks);
				}

				console.log(`Retrying asset [${fileId}] ${i.source}`);

				if (cancelAcquisition)
				{
					break;
				}

				await fs.promises.mkdir(path.dirname(i.target), { recursive: true });
				const oneRequest = doRequest(session, i.target, i.source).then(() => 
				{
					requestTasks.splice(requestTasks.indexOf(oneRequest), 1);
				}).catch(() => 
				{
					requestTasks.splice(requestTasks.indexOf(oneRequest), 1);
				});
				requestTasks.push(oneRequest);
			}

			await Promise.all(requestTasks);

			if (imagesRequiringRetry && imagesRequiringRetry.length === 0)
			{
				console.log(`Retry ${i + 1} acquired all remaining files.`);
				break;
			}
		}
	}

	if (imagesRequiringRetry && imagesRequiringUpdate.length > 0)
	{
		console.log(`Retrying failed to acquire erroring files.`);
	}

	if (session)
	{
		closeSession(session);
		session = null;
	}

	console.log("Requests complete.");

	if (cancelAcquisition)
	{
		cancelAcquisition = false;
		downloadInProgress = false;

		// If we cancel, we'll have files we already downloaded so we should clear the cached list and recreate it
		imagesRequiringUpdate = null;
		numTransferred = 0;
		checkImageManifest();
	}
	else
	{
		let currentManifestHash = await getFileHash(path.join(app.getAppPath(), "image-manifest.json"));
		fs.writeFileSync(path.join(basePath, "downloaded.json"), JSON.stringify({ installed: true, manifestHash: currentManifestHash }));

		downloadInProgress = false;
		win.webContents.send("acquireImages:downloadComplete");
	}
}

async function handleCancelImages()
{
	if (downloadInProgress)
	{
		cancelAcquisition = true;
	}
}

async function getFileHash(path, alg = "md5")
{
	return new Promise((resolve, __reject) => 
	{
		let hash = crypto.createHash(alg);
		let stream = fs.createReadStream(path);
		stream.on("error", __err => resolve(false));
		stream.on("data", chunk => hash.update(chunk));
		stream.on("end", () => resolve(hash.digest("base64")));
	});
}

async function checkImageManifest()
{
	let downloadedHashMatches = false;

	let manifestPath = path.join(app.getAppPath(), "image-manifest.json");
	if (!fs.existsSync(manifestPath))
	{
		console.log("Couldn't find image manifest file at:", manifestPath);
		return;
	}
	const manifestHash = await getFileHash(path.join(app.getAppPath(), "image-manifest.json"));

	let markerPath = path.join(app.getPath("userData"), "ImagePack", "downloaded.json");
	if (fs.existsSync(markerPath))
	{
		const downloadedHash = JSON.parse(fs.readFileSync(markerPath));

		if (downloadedHash.manifestHash === manifestHash)
		{
			downloadedHashMatches = true;
			console.log("Downloaded hash matches game hash.")
		}
		else
		{
			console.log("Downloaded hash mismatches game hash.");
		}
	}

	if (downloadedHashMatches)
	{
		hasImagesAvailableForUpdate(0, 0);
		return;
	}

	let requiredFileUpdates = [];
	let totalSize = 0;

	let images = fs.readFileSync(manifestPath, "utf8");
	images = JSON.parse(images);

	for (const i of images)
	{
		for (const s of packSizes)
		{
			let basePath = i.paths[s];
			if (process.platform === "linux" || process.platform === "darwin")
			{
				basePath = basePath.replaceAll("\\", "/");
			}
			
			let storedFilePath = path.normalize(path.join(app.getPath("userData"), "ImagePack", basePath));
			let remoteFilePath = `${baseURI}${i.paths[s].replaceAll("\\", "/")}`

			const fileHash = await getFileHash(storedFilePath, "md5");

			if (fileHash !== i.hashes[s])
			{
				requiredFileUpdates.push({
					source: remoteFilePath,
					target: storedFilePath
				});
				totalSize += i.sizes[s];
			}
		}
	}

	imagesRequiringUpdate = requiredFileUpdates;
	hasImagesAvailableForUpdate(requiredFileUpdates.length, totalSize);
}

async function handleDeleteImages()
{
	// Clear the cache folder entirely.
	let folderPath = path.join(app.getPath("userData"), "ImagePack");

	if (fs.existsSync(folderPath))
	{
		fs.rmdirSync(folderPath, { recursive: true });
	}
}

async function hasImagesAvailableForUpdate(numImages = 0, projectedSize = 0)
{
	console.log(`Sending message to render process for ${numImages} images`);
	win.webContents.send("acquireImages:notifyAvailable", numImages, projectedSize);
}