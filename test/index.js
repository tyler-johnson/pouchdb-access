import test from "tape";
import PouchDB from "pouchdb";
import accessPlugin from "pouchdb-access";

PouchDB.plugin(accessPlugin);

test("access() method returns an access object", (t) => {
	t.plan(2);
	let db = new PouchDB("tmpdb", { adapter: "memory" });
	let access = db.access();

	t.ok(access, "returns access object");
	t.equals(access.remote, false, "access is not remote");
});
