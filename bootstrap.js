"use strict"

const { interfaces: Ci, utils: Cu } = Components;

// TODO use something like https://github.com/Mardak/restartless/tree/unload
// for cleanup
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Home.jsm");
Cu.import("resource://gre/modules/HomeProvider.jsm");
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/PageActions.jsm");

var menuHandler = {};
var PANEL_ID = "home-panel-ScrapBook-Android";
var DATASET_ID = "dataset-ScrapBook-Android";

function sbReportException(prefix, e) {
	Cu.reportError(prefix + ": " + (e && e.message));
	Cu.reportError(e && e.stack);
}

function customizeCaptureComplete(observerCallback) {
	var fun = observerCallback.onCaptureComplete;
	observerCallback.onCaptureComplete = function(aItem) {
		fun.call(observerCallback, aItem);
		if(aItem) {
			var items = [{
				title: aItem.title,
					description: aItem.source,
					url: sbDataSource.convertIdToURL(aItem.id)
			}];
			let storage = HomeProvider.getStorage(DATASET_ID);
			storage.save(items).then(null, sbReportException.bind(null, "customCaptureComplete"));
		} else {
			refreshDataset();
		}
	};
}

function onPageShow(aEvent) {
	let aWindow = sbCommonUtils.getFocusedWindow();
	if (aWindow) {
		updatePageActions(aWindow, null, aEvent.target.location.href);
	}
}

function onTabSelect(aEvent) {
	let aWindow = aEvent.currentTarget.ownerDocument.defaultView;
	updatePageActions(aWindow, null, aEvent.target.currentURI.spec, aWindow);
}

function updatePageActions(aWindow, aTab, pageUri) {
	if (menuHandler.pageAction) {
		PageActions.remove(menuHandler.pageAction);
		menuHandler.pageAction = null;
	}
	if (menuHandler.removeHanger) {
		menuHandler.removeHanger();
		menuHandler.removeHanger = null;
	}
	var sbDir = sbCommonUtils.getBaseHref(sbDataSource.data.URI) + "data/";
	var resourceId = sbCommonUtils.convertURLToId(pageUri);
	if (
		pageUri.length <= sbDir.length // Just browsing the directory
		|| pageUri.substr(0, sbDir.length) != sbDir
	) {
		return;
	}
	var tabId = aWindow.BrowserApp.selectedTab.id;
	menuHandler.pageAction = PageActions.add({
		icon: "chrome://scrapbook/skin/main_32.png",
		title: "ScrapBook X",
		clickCallback: function() {
		// TODO Dialog with rename option
		// TODO translations
		let buttons = [
			{
				label: "Delete",
				callback: function() {
					var aRes = sbCommonUtils.RDF.GetResource("urn:scrapbook:item" + resourceId);
					var aParentRes = sbDataSource.findParentResource(aRes);
					try {
						sbController.removeInternal([aRes], [aParentRes], true);
					} catch (e) {
						sbReportException("Remove item", e);
					}
					refreshDataset();
					sbCommonUtils.getFocusedWindow().BrowserApp.loadURI("about:home?panel=" + PANEL_ID);
				}
			}
			, {
				label: "Cancel",
				callback: function() {}
			}
		];
		let message = sbCommonUtils.lang("scrapbook", "CONFIRM_DELETE");
		aWindow.NativeWindow.doorhanger.show(message, "remove-hanger", buttons, tabId, {});
		menuHandler.removeHanger = function(w) {
			w.NativeWindow.doorhanger.hide("remove-hanger", tabId);
		}.bind(null, aWindow);
		}
	});
}

function loadIntoWindow(aWindow) {
	if (!aWindow) {
		return;
	}
	menuHandler.capture = aWindow.NativeWindow.menu.add({
		name: sbCommonUtils.lang("scrapbook", "CAPTURE_OK_BUTTON"),
		icon: "chrome://scrapbook/skin/main_32.png",
		callback: function() {
			sbBrowserOverlay.execCapture(2, false, false, 'urn:scrapbook:root');
		}
	});
	menuHandler.selection = aWindow.SelectionHandler.addAction({
		label: sbCommonUtils.lang("scrapbook", "CAPTURE_OK_BUTTON"),
		selector: { matches: function() { return true; } },
		icon: "chrome://scrapbook/skin/main_32.png",
		action: function() {
			let aWindow = Services.wm.getMostRecentWindow("navigator:browser");
			sbBrowserOverlay.execCapture(1, false, false, 'urn:scrapbook:root');
		}
	});
	aWindow.BrowserApp.deck.addEventListener("pageshow", onPageShow, false);
	aWindow.BrowserApp.deck.addEventListener("TabSelect", onTabSelect, false);
}

function unloadFromWindow(aWindow) {
	if (!aWindow) {
		return;
	}
	aWindow.BrowserApp.deck.removeEventListener("TabSelect", onTabSelect, false);
	aWindow.BrowserApp.deck.removeEventListener("pageshow", onPageShow, false);
	if (menuHandler.capture) {
		aWindow.NativeWindow.menu.remove(menuHandler.capture);
		menuHandler.save = null;
	}
	if (menuHandler.selection) {
		aWindow.SelectionHandler.removeAction(menuHandler.selection);
		menuHandler.selection = null;
	}
}

var windowListener = {
	onOpenWindow: function(aWindow) {
		var win = aWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(
			Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow
		);
		// on "load" event win.BrowserApp.deck is null
		function loadListener() {
			win.removeEventListener("UIReady", loadListener, false);
			loadIntoWindow(win);
		}
		win.addEventListener("UIReady", loadListener, false);
	},
	onCloseWindow: function(aWindow) {},
	onWindowTitleChange: function(aWindow, aTitle) {}
};

function refreshDataset() {
	let items = [];
	var resEnum = sbDataSource.data.GetAllResources();
	while (resEnum.hasMoreElements()) {
		var res = resEnum.getNext();
		if (sbDataSource.isContainer(res)) {
			continue;
		}
		var id = sbDataSource.getProperty(res, "id");
		if (!id) {
			continue;
		}
		var type = sbDataSource.getProperty(res, "type");
		if (["folder", "separator", "bookmark"].indexOf(type) != -1) {
			continue;
		}
		items.push({
			title: sbDataSource.getProperty(res, "title"),
			description: sbDataSource.getProperty(res, "source"),
			url: sbDataSource.convertIdToURL(id)
		});
			// sbDataSource.getProperty(res, "folder"),
			// sbDataSource.getProperty(res, "create"),
			// sbDataSource.getProperty(res, "modify"),
	}
	// TODO implement folders as filters
	/*
	[{
		title: "filter",
		url: "filter://folder",
		image_url: "chrome://scrapbook/skin/main_32.png"
	}
	, {
		title: "Filter Folder",
		url: "google.com",
		description: "Filter Folder google.com",
		filter: "folder"
	}];
	*/
	// TODO sort
	// TODO paging if > 100 items

	Task.spawn(function () {
		let storage = HomeProvider.getStorage(DATASET_ID);
		yield storage.deleteAll();
		yield storage.save(items);
	}).then(null, function(e) {
		sbReportException("Refresh dataset", e);
	});
}

function startup(aData, aReason) {
	Cu.import("chrome://scrapbook-modules/content/settimeout.jsm");
	Cu.import("chrome://scrapbook-modules/content/common.jsm");
	Cu.import("chrome://scrapbook-modules/content/datasource.jsm");

	Services.scriptloader.loadSubScript("chrome://scrapbook/content/saver.js");
	Services.scriptloader.loadSubScript("chrome://scrapbook/content/scrapbook.js");
	Services.scriptloader.loadSubScript("chrome://scrapbook/content/overlay.js");

	customizeCaptureComplete(sbCaptureObserverCallback);

	let windows = Services.wm.getEnumerator("navigator:browser");
	while (windows.hasMoreElements()) {
		let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
		loadIntoWindow(domWindow);
	}
	Services.wm.addListener(windowListener);

	try {
		Home.panels.register(PANEL_ID, function() {
			return {
				title: "ScrapBook X", // TODO translation
				views: [{
					type: Home.panels.View.LIST,
					dataset: DATASET_ID,
					empty: {
						text: "Capture whole pages from window menu"
							+" or their fragments from selection menu"
							+" and they appear here",
						imageUrl: "chrome://scrapbook/skin/main_32.png"
					},
					onrefresh: refreshDataset
				}]
			};
		});

		Home.panels.install(PANEL_ID);
		if (aReason == ADDON_INSTALL || aReason == ADDON_ENABLE) {
			HomeProvider.requestSync(DATASET_ID, refreshDataset);
		}
	} catch (e) {
		sbReportException("startup", e);
	}
}

function shutdown(aData, aReason) {
	if (aReason == APP_SHUTDOWN) {
		return;
	}

	try {
		// when installing, windowListener.onOpenWindow is not fired
		Services.wm.removeListener(windowListener);
	} catch (e) {}
	let windows = Services.wm.getEnumerator("navigator:browser");
	try {
	if (menuHandler.pageAction) {
		PageActions.remove(menuHandler.pageAction);
		menuHandler.pageAction = null;
	}
	} catch (e) {
		sbReportException("Remove page action");
	}
	while (windows.hasMoreElements()) {
		let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
		unloadFromWindow(domWindow);
	}

	clearAllTimeout();
	Cu.unload("chrome://scrapbook-modules/content/datasource.jsm");
	Cu.unload("chrome://scrapbook-modules/content/common.jsm");
	Cu.unload("chrome://scrapbook-modules/content/settimeout.jsm");
	if (aReason == ADDON_UNINSTALL || aReason == ADDON_DISABLE) {
		try {
			Home.panels.uninstall(PANEL_ID);
		} catch (e) {
			sbReportException("Uninstall home panel", e);
		}

		let storage = HomeProvider.getStorage(DATASET_ID);
		if (storage) {
			storage.deleteAll().then(null, sbReportException.bind(null, "Shutdown clear storage"));
		}
	}
	try {
		Home.panels.unregister(PANEL_ID);
	} catch (e) {
		sbReportException("Unregister home panel", e);
	}
}

function install() {}
function uninstall() {}

