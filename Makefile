PACKAGE_NAME := dist.zip

ifeq ($(OS),Windows_NT)
PNPM := pnpm.cmd
RM_DIST := powershell -NoProfile -Command "if (Test-Path 'dist') { Remove-Item 'dist' -Recurse -Force }"
RM_ZIP := powershell -NoProfile -Command "if (Test-Path '$(PACKAGE_NAME)') { Remove-Item '$(PACKAGE_NAME)' -Force }"
ZIP_DIST := powershell -NoProfile -Command "if (Test-Path '$(PACKAGE_NAME)') { Remove-Item '$(PACKAGE_NAME)' -Force }; tar -a -c -f '$(PACKAGE_NAME)' -C 'dist' ."
else
PNPM := pnpm
RM_DIST := rm -rf dist
RM_ZIP := rm -f $(PACKAGE_NAME)
ZIP_DIST := cd dist && zip -r ../$(PACKAGE_NAME) .
endif

.PHONY: install build zip package clean

install:
	$(PNPM) install

build:
	$(PNPM) build

zip:
	$(ZIP_DIST)

package: build zip

clean:
	$(RM_DIST)
	$(RM_ZIP)
