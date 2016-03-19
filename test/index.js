import test from "tape";
import PouchDB from "pouchdb";
import accessPlugin from "pouchdb-access";
import {Security} from "pouchdb-security-helper";

PouchDB.plugin(accessPlugin);

test("access() method returns an access object", (t) => {
	t.plan(2);
	let db = new PouchDB("tmpdb", { adapter: "memory" });
	let access = db.access();

	t.ok(access, "returns access object");
	t.equals(access.remote, false, "access is not remote");
});

test("parses simplified access info", (t) => {
	t.plan(6);
	let db = new PouchDB("tmpdb", { adapter: "memory" });
	let oaccess = db.access();
	oaccess.setPrivate();
	oaccess.addLevel("test");
	let simple = oaccess.toJSON();
	t.equals(simple.private, true, "is private");
	t.ok(Array.isArray(simple.levels), "levels is an array");
	t.equals(simple.levels.length, 1, "levels has one item");
	t.equals(simple.levels[0].name, "test", "level has correct name");
	t.deepEquals(simple.levels[0].sec, (new Security.Level()).toJSON(), "level has security document");

	let access = db.access(simple);
	t.deepEquals(access.toJSON(), simple, "set access to the original simplified version");
});
