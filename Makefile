BIN = ./node_modules/.bin
SRC = $(wildcard src/* src/*/*)
TEST = $(wildcard test/* test/*/*)

build: index.js

index.js: src/index.js $(SRC)
	$(BIN)/rollup $< -c > $@

test.js: test/index.js index.js $(TEST)
	$(BIN)/rollup $< -c > $@

test: test-node test-browser
	make clean-self

test-node: test.js install-self
	node $<

test-browser: test.js install-self
	$(BIN)/browserify $< --debug | $(BIN)/tape-run

install-self: clean-self
	ln -s ../ node_modules/pouchdb-access

clean-self:
	rm -f node_modules/pouchdb-access

clean:
	rm -f index.js test.js

.PHONY: build clean test test-node test-browser install-self clean-self
