PACKAGE_NAME := dist.zip

.PHONY: install build zip package clean

install:
	pnpm.cmd install

build:
	pnpm.cmd build

zip:
	powershell -NoProfile -Command "if (Test-Path '$(PACKAGE_NAME)') { Remove-Item '$(PACKAGE_NAME)' -Force }; Compress-Archive -Path 'dist\\*' -DestinationPath '$(PACKAGE_NAME)' -Force"

package: build zip

clean:
	powershell -NoProfile -Command "if (Test-Path 'dist') { Remove-Item 'dist' -Recurse -Force }; if (Test-Path '$(PACKAGE_NAME)') { Remove-Item '$(PACKAGE_NAME)' -Force }"
