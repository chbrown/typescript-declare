DTS := node/node yargs/yargs

.PHONY: all
all: bin/index.js build.js
type_declarations: $(DTS:%=type_declarations/DefinitelyTyped/%.d.ts)

%.js: %.ts type_declarations
	node_modules/.bin/tsc -m commonjs -t ES5 $<

type_declarations/DefinitelyTyped/%:
	mkdir -p $(@D)
	curl -s https://raw.githubusercontent.com/chbrown/DefinitelyTyped/master/$* > $@
