
XPI = scrapbook-android.xpi
MODULES_JS += common.jsm datasource.jsm settimeout.jsm
CONTENT_JS += saver.js scrapbook.js overlay.js
RESOURCE += main_32.png treeitem.png
LOCALE_PROPERTIES += scrapbook.properties overlay.properties
LOCALE_LANG += ar cs-CZ de en-US es-ES fi-FI fr gl-ES hu-HU it ja ko-KR
LOCALE_LANG += pl pt-BR ro ru-RU sk-SK sv-SE tr uk zh-CN zh-TW
CHROME_MANIFEST += desktop.manifest android.manifest

# Replace this value to push to different release channels.
# Nightly = org.mozilla.fennec
# Aurora = org.mozilla.fennec_aurora
# Beta = org.mozilla.firefox_beta
# Release = org.mozilla.firefox
ANDROID_APP_ID=org.mozilla.firefox

ADB = adb
ZIP = zip
DEFAULT_JS = bootstrap.js
DEFAULT_RESOURCE = install.rdf chrome.manifest README.md
JS = $(MODULES_JS:%=modules/%) $(CONTENT_JS:%=chrome/content/scrapbook/%)
RESOURCE_FILES = $(RESOURCE:%=chrome/skin/classic/scrapbook/%)
LOCALE = $(foreach i, $(LOCALE_LANG), $(addprefix chrome/locale/$(i)/scrapbook/, $(LOCALE_PROPERTIES)))

all: zip

clean:
	$(RM) $(XPI)

push: zip
	$(ADB) push "$(XPI)" /mnt/sdcard/"$(XPI)"

install: push
	$(ADB) shell am start -a android.intent.action.VIEW \
		-c android.intent.category.DEFAULT \
		-d file:///mnt/sdcard/"$(XPI)" \
		-n "$(ANDROID_APP_ID)"/.App

zip: $(XPI)
$(XPI): $(DEFAULT_RESOURCE) $(CHROME_MANIFEST) $(DEFAULT_JS) $(JS) $(RESOURCE_FILES) $(LOCALE)

%.xpi:
	$(ZIP) $@ $^

.PHONY: clean zip push install check

