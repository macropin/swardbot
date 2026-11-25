# SwardBot — parametric chassis.
#
# src/layout.ts holds every chassis dimension and derives the rest: positions,
# tube cut list, mass budget and the checks the layout must pass. Printed parts
# are src/<name>.brep.ts modules built from it, and parts made in metal are in
# src/machined/; src/assemblies/ holds scenes, not parts: the whole mower for
# renders, never printed or verified against dimensions. Requires Node 24+
# (`brew install node`).

PARTS   := $(patsubst src/%.brep.ts,%,$(wildcard src/*.brep.ts))
# Parts made in metal, never printed: verified and rendered, exported as STEP only.
MACHINED := $(patsubst src/machined/%.brep.ts,%,$(wildcard src/machined/*.brep.ts))
PART    ?=
SELECT  := $(or $(PART),$(PARTS))
SCENES  := $(patsubst src/assemblies/%.brep.ts,%,$(wildcard src/assemblies/*.brep.ts))
SCENE   ?=
SHOW    := $(or $(SCENE),$(SCENES))
OUT     := out
MEDIA   := media
BREP    := npx brep
PREVIEW_WIDTH := 760

.DEFAULT_GOAL := help

## help: list the available targets and parts
help:
	@echo "swardbot — make targets:"
	@echo
	@sed -n 's/^## //p' $(MAKEFILE_LIST) | awk -F': ' '{printf "  \033[1m%-10s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo "parts:  $(or $(PARTS),(none yet))"
	@echo "machined: $(MACHINED)"
	@echo "scenes: $(SCENES)"
	@echo

## install: install the toolchain (brepjs + OCCT kernel)
install: node_modules

node_modules: package.json
	npm install
	@touch node_modules

## layout: print the layout, mass budget, checks and cut list (overrides: ARGS="bladeDiameter=400 trayDiameter=440")
layout: node_modules
	@mkdir -p $(OUT)
	@node scripts/layout-report.mjs $(ARGS) --json $(OUT)/layout.json

## typecheck: type-check the layout, parts and scenes
typecheck: node_modules
	npx tsc -p .

## verify: type-check, pass the layout checks, and check each part is a valid solid matching its declared dimensions
verify: typecheck
	@node scripts/layout-report.mjs > /dev/null || node scripts/layout-report.mjs
	@set -e; for p in $(SELECT); do \
		mkdir -p $(OUT)/$$p; \
		$(BREP) verify src/$$p.brep.ts --check --json $(OUT)/$$p/report.json; \
	done
	@set -e; for p in $(if $(PART),,$(MACHINED)); do \
		mkdir -p $(OUT)/$$p; \
		$(BREP) verify src/machined/$$p.brep.ts --check --json $(OUT)/$$p/report.json; \
	done

## render: write iso/front/top/right PNGs of each part and scene, and refresh media/ previews
render: node_modules
	@set -e; for p in $(SELECT); do \
		mkdir -p $(OUT)/$$p $(MEDIA); \
		$(BREP) verify src/$$p.brep.ts --check --snapshot $(OUT)/$$p/shots; \
		$(MAKE) --no-print-directory $(MEDIA)/$$p.png; \
	done
	@set -e; for p in $(if $(PART),,$(MACHINED)); do \
		mkdir -p $(OUT)/$$p $(MEDIA); \
		$(BREP) verify src/machined/$$p.brep.ts --check --snapshot $(OUT)/$$p/shots; \
		$(MAKE) --no-print-directory $(MEDIA)/$$p.png; \
	done
	@set -e; for s in $(SHOW); do \
		mkdir -p $(OUT)/$$s $(MEDIA); \
		$(BREP) snapshot src/assemblies/$$s.brep.ts --out $(OUT)/$$s/shots; \
		$(MAKE) --no-print-directory $(MEDIA)/$$s.png $(MEDIA)/$$s-side.png; \
	done

# The snapshot renderer fits the model with a wide margin and burns a size label
# into the corner. Drop the label, trim to the model, pad, and scale up. -strip
# and the chunk exclusions keep an unchanged model's preview byte-identical.
CROP = magick $< -gravity South -chop 0x80 +repage -fuzz 10% -trim +repage \
	-bordercolor 'srgb(6,6,12)' -border 26 -filter Lanczos -resize $(PREVIEW_WIDTH)x \
	-unsharp 0x0.6+0.7+0.01 -strip -define png:exclude-chunks=date,time $@

$(MEDIA)/%-side.png: $(OUT)/%/shots/front.png
	@if command -v magick >/dev/null 2>&1; then $(CROP) && echo "preview -> $@"; else cp $< $@; fi

$(MEDIA)/%.png: $(OUT)/%/shots/iso.png
	@if command -v magick >/dev/null 2>&1; then $(CROP) && echo "preview -> $@"; else cp $< $@; fi

## views: render the whole mower in colour from several angles, for the README (media/views/; VIEWS="side top" for some)
views: node_modules
	@node scripts/render-views.mjs $(VIEWS)

## preview: open the live viewer for PART or SCENE, re-evaluating on save
preview: node_modules
	@if [ -n "$(PART)" ]; then $(BREP) preview src/$(PART).brep.ts --watch; \
	elif [ -n "$(SCENE)" ]; then $(BREP) preview src/assemblies/$(SCENE).brep.ts --watch; \
	else echo "usage: make preview PART=<name> | SCENE=<name>  (scenes: $(SCENES))"; exit 2; fi

## export: write STEP + STL of each printed part, STEP of each machined part and scene, behind a validity gate
export: node_modules
	@set -e; for p in $(SELECT); do \
		mkdir -p $(OUT)/$$p; \
		$(BREP) export src/$$p.brep.ts --step --stl --out $(OUT)/$$p; \
	done
	@set -e; for p in $(if $(PART),,$(MACHINED)); do \
		mkdir -p $(OUT)/$$p; \
		$(BREP) export src/machined/$$p.brep.ts --step --out $(OUT)/$$p; \
	done
	@set -e; for s in $(SHOW); do \
		mkdir -p $(OUT)/$$s; \
		$(BREP) export src/assemblies/$$s.brep.ts --step --out $(OUT)/$$s; \
	done

## all: verify, render, render the views and export
all: verify render views export

## clean: remove generated artifacts (keeps the media/ previews)
clean:
	rm -rf $(OUT)

.PHONY: help install layout typecheck verify render views preview export all clean
