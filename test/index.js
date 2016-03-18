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
	t.plan(1);
	let db = new PouchDB("tmpdb", { adapter: "memory" });

	let simple = {
		private: true,
		levels: [{
			name: "test",
			sec: new Security.Level()
		}]
	};

	let access = db.access(simple);

	t.deepEquals(access.toJSON(), simple, "set access to the original simplified version");
});
